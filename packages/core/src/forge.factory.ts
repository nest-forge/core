import {
	DynamicModule,
	ForwardReference,
	Global,
	INestApplication,
	INestApplicationContext,
	MiddlewareConsumer,
	Module,
	ModuleMetadata,
	NestApplicationOptions,
	Type,
} from '@nestjs/common';
import { ForgeApplicationContextOptions, ForgeApplicationOptions, ForgeMicroserviceOptions } from './forge-options.interface';
import { ForgeExtension, ForgeExtensionResolvable } from './extensions';
import { AbstractHttpAdapter, ModuleRef, NestApplicationContext, NestFactory } from '@nestjs/core';
import {
	FORGE_FIELD_MODULE_REF,
	FORGE_PATCH_BOOT_CALLBACK,
	FORGE_PATCH_ENABLE_INIT,
	FORGE_PATCHED,
	FORGE_TOKEN_ROOT_MODULE,
} from './constants';
import { ForgeBaseComponent, ForgeController, ForgeModule, ForgeService } from './architecture';
import { NestApplicationContextOptions } from '@nestjs/common/interfaces/nest-application-context-options.interface';
import { NestMicroserviceOptions } from '@nestjs/common/interfaces/microservices/nest-microservice-options.interface';
import { FORGE_APP_OPTIONS, FORGE_ROOT_MODULE } from './constants-public';

class Forge {
	private _augmented = new Set<ForgeBaseComponent>();

	public async create<T extends INestApplication = INestApplication>(
		appModule: IEntryNestModule,
		options?: ForgeApplicationOptions
	): Promise<T>;

	public async create<T extends INestApplication = INestApplication>(
		appModule: IEntryNestModule,
		httpAdapter: AbstractHttpAdapter,
		options?: ForgeApplicationOptions
	): Promise<T>;

	public async create<T extends INestApplication = INestApplication>(
		appModule: IEntryNestModule,
		optionsOrHttpAdapter?: ForgeApplicationOptions | AbstractHttpAdapter,
		optionsFallback?: ForgeApplicationOptions
	): Promise<T> {
		let adapter = this._isHttpAdapter(optionsOrHttpAdapter) ? optionsOrHttpAdapter : undefined;

		const options =
			(typeof optionsFallback === 'object' ? optionsFallback : adapter ? {} : (optionsOrHttpAdapter as ForgeApplicationOptions)) ??
			{};

		const extensions = this.discoverExtensions(options?.extensions ?? []);
		const root = await this.createRootModule(appModule, extensions, options);
		const instrument = this.createInstrument(extensions, options.instrument);

		let createOptions: NestApplicationOptions = {
			...options,
			instrument: {
				instanceDecorator: instrument.instanceDecorator,
			},
		};

		for (const extension of extensions) {
			const newOptions = await extension.configureHttpApplicationOptions(createOptions);
			const newAdapter = await extension.configureHttpAdapter(adapter);

			if (typeof newOptions === 'object' && newOptions !== null) {
				createOptions = newOptions;
			}

			if (typeof newAdapter === 'object' && newAdapter !== null) {
				adapter = newAdapter;
			}
		}

		const createArgs: any[] = [root, createOptions];

		if (adapter) {
			createArgs.splice(1, 0, adapter);
		}

		this._augmentBootHooks(createOptions, extensions);
		this._augmentNestApplication();

		const app = await NestFactory.create.apply(NestFactory, createArgs as any);

		await this.augmentComponents(instrument.instances, extensions);

		for (const extension of extensions) {
			await extension.configureHttpApplication(app);
		}

		return app as T;
	}

	public async createApplicationContext(appModule: IEntryNestModule, options: ForgeApplicationContextOptions) {
		const extensions = this.discoverExtensions(options?.extensions ?? []);
		const root = this.createRootModule(appModule, extensions, options);
		const instrument = this.createInstrument(extensions, options.instrument);

		let createOptions: NestApplicationContextOptions = {
			...options,
			instrument: {
				instanceDecorator: instrument.instanceDecorator,
			},
		};

		for (const extension of extensions) {
			const newOptions = await extension.configureStandaloneApplicationOptions(createOptions);

			if (typeof newOptions === 'object' && newOptions !== null) {
				createOptions = newOptions;
			}
		}

		createOptions[FORGE_PATCH_ENABLE_INIT] = false;

		this._augmentBootHooks(createOptions, extensions);
		this._augmentNestApplication();

		const app = await NestFactory.createApplicationContext(root, createOptions);

		await this.augmentComponents(instrument.instances, extensions);

		for (const extension of extensions) {
			await extension.configureStandaloneApplication(app);
		}

		createOptions[FORGE_PATCH_ENABLE_INIT] = true;
		await app.init();

		return app;
	}

	public async createMicroservice<T extends object>(appModule: IEntryNestModule, options: ForgeMicroserviceOptions & T) {
		const extensions = this.discoverExtensions(options?.extensions ?? []);
		const root = this.createRootModule(appModule, extensions, options);
		const instrument = this.createInstrument(extensions, options.instrument);

		let createOptions: NestMicroserviceOptions & T = {
			...options,
			instrument: {
				instanceDecorator: instrument.instanceDecorator,
			},
		};

		for (const extension of extensions) {
			const newOptions = await extension.configureMicroserviceApplicationOptions(createOptions);

			if (typeof newOptions === 'object' && newOptions !== null) {
				createOptions = newOptions as NestMicroserviceOptions & T;
			}
		}

		this._augmentBootHooks(createOptions, extensions);
		this._augmentNestApplication();

		const app = await NestFactory.createMicroservice<T>(root, createOptions);

		await this.augmentComponents(instrument.instances, extensions);

		for (const extension of extensions) {
			await extension.configureMicroserviceApplication(app);
		}

		return app;
	}

	protected discoverExtensions(resolvables: ForgeExtensionResolvable | ForgeExtensionResolvable[]): ForgeExtension[] {
		const extensions = new Map<ForgeExtensionConstructor, ForgeExtension>();

		if (!Array.isArray(resolvables)) {
			resolvables = [resolvables];
		}

		for (const resolvable of resolvables) {
			const extension = this.resolveExtension(resolvable);

			if (extension !== null) {
				for (const nestedExtension of this.discoverExtensions(extension.getNestedExtensions())) {
					extensions.delete(nestedExtension.constructor as ForgeExtensionConstructor);
					extensions.set(nestedExtension.constructor as ForgeExtensionConstructor, nestedExtension);
				}

				extensions.delete(extension.constructor as ForgeExtensionConstructor);
				extensions.set(extension.constructor as ForgeExtensionConstructor, extension);
			}
		}

		return Array.from(extensions.values());
	}

	protected resolveExtension(resolvable: ForgeExtensionResolvable): ForgeExtension | null {
		if (resolvable === false || resolvable === null || resolvable === undefined) {
			return null;
		}

		if (typeof resolvable === 'object') {
			return resolvable;
		}

		if (typeof resolvable === 'function') {
			return new resolvable();
		}

		throw new Error(`Unsupported extension resolvable "${String(resolvable)}"`);
	}

	protected async createRootModule(appModule: IEntryNestModule, extensions: ForgeExtension[], options: any) {
		const meta: ModuleMetadata = {
			imports: [],
			controllers: [],
			providers: [],
			exports: [],
		};

		for (const extension of extensions) {
			const extensionMeta = await this._getExtensionMetadata(extension);

			meta.imports!.push(...extensionMeta.imports);
			meta.controllers!.push(...extensionMeta.controllers);
			meta.providers!.push(...extensionMeta.providers);
			meta.exports!.push(...extensionMeta.exports);
		}

		meta.imports!.push(appModule as any);

		@Module(meta)
		@Global()
		class ForgeRootModule implements IForgeRootModule {
			public readonly [FORGE_ROOT_MODULE] = true;

			public constructor(public readonly moduleRef: ModuleRef) {}

			public async configure(consumer: MiddlewareConsumer) {
				for (const extension of extensions) {
					await extension.configureRootModule(consumer);
				}
			}
		}

		@Global()
		@Module({
			providers: [
				{
					provide: FORGE_TOKEN_ROOT_MODULE,
					useClass: ForgeRootModule,
				},
				{
					provide: FORGE_APP_OPTIONS,
					useValue: options,
				},
			],
			exports: [FORGE_TOKEN_ROOT_MODULE, FORGE_APP_OPTIONS],
		})
		class ForgeRootProviderModule {}

		meta.imports!.unshift(ForgeRootProviderModule);

		return ForgeRootModule;
	}

	protected async _getExtensionMetadata(extension: ForgeExtension): Promise<ExtensionMetadata> {
		const results = await Promise.all([
			extension.getRootImports(),
			extension.getRootProviders(),
			extension.getRootExports(),
			extension.getRootControllers(),
			extension.getNestedExtensions(),
		]);

		return {
			imports: results[0],
			providers: results[1],
			exports: results[2],
			controllers: results[3],
			extensions: results[4],
		};
	}

	protected createInstrument(extensions: ForgeExtension[], originalInstrument?: Instrument): InstrumentResponse {
		const hasOriginalInstrument = originalInstrument && originalInstrument.instanceDecorator;
		const instances = new Array<ForgeBaseComponent>();

		return {
			instances,
			instanceDecorator: (instance) => {
				if (this._isRootModule(instance)) {
					// TODO
				}

				if (instance instanceof ForgeBaseComponent) {
					instances.push(instance);
				}

				for (const extension of extensions) {
					const response = extension.instrument(instance);

					if (response !== undefined) {
						return response;
					}
				}

				if (hasOriginalInstrument) {
					return originalInstrument.instanceDecorator(instance);
				}

				return instance;
			},
		};
	}

	protected async augmentComponents(instances: ForgeBaseComponent[], extensions: ForgeExtension[]) {
		for (const instance of instances) {
			if (!this._augmented.has(instance)) {
				await this.augmentComponent(instance, extensions);

				if (instance instanceof ForgeModule) {
					await this.augmentModule(instance, extensions);
				} else if (instance instanceof ForgeController) {
					await this.augmentController(instance, extensions);
				} else if (instance instanceof ForgeService) {
					await this.augmentService(instance, extensions);
				}

				this._augmented.add(instance);
			}
		}
	}

	protected async augmentComponent(instance: ForgeBaseComponent, extensions: ForgeExtension[]) {
		for (const extension of extensions) {
			await extension.augmentComponent(instance, instance[FORGE_FIELD_MODULE_REF]);
		}
	}

	protected async augmentModule(instance: ForgeModule, extensions: ForgeExtension[]) {
		for (const extension of extensions) {
			await extension.augmentModule(instance, instance[FORGE_FIELD_MODULE_REF]);
		}
	}

	protected async augmentController(instance: ForgeController, extensions: ForgeExtension[]) {
		for (const extension of extensions) {
			await extension.augmentController(instance, instance[FORGE_FIELD_MODULE_REF]);
		}
	}

	protected async augmentService(instance: ForgeService, extensions: ForgeExtension[]) {
		for (const extension of extensions) {
			await extension.augmentService(instance, instance[FORGE_FIELD_MODULE_REF]);
		}
	}

	protected _isRootModule(instance: unknown): instance is IForgeRootModule {
		return typeof instance === 'object' && instance !== null && instance[FORGE_ROOT_MODULE] === true;
	}

	protected _isHttpAdapter(instance: unknown): instance is AbstractHttpAdapter {
		return typeof instance === 'object' && instance !== null && typeof instance['use'] === 'function';
	}

	protected _augmentBootHooks(createOptions: object, extensions: ForgeExtension[]) {
		createOptions[FORGE_PATCH_BOOT_CALLBACK] = async (app: INestApplicationContext) => {
			await Promise.all(extensions.map((e) => e.afterBoot(app)));
		};
	}

	protected _augmentNestApplication() {
		const application = NestApplicationContext as any;
		const originalBootstrapHook = application.prototype.callBootstrapHook;
		const originalInit = application.prototype.init;

		if (application.prototype[FORGE_PATCHED]) {
			return;
		}

		application.prototype[FORGE_PATCHED] = true;

		application.prototype.callBootstrapHook = async function (this: NestApplicationContext) {
			await originalBootstrapHook.call(this);

			if (this.appOptions[FORGE_PATCH_BOOT_CALLBACK]) {
				await this.appOptions[FORGE_PATCH_BOOT_CALLBACK](this);
			}
		};

		application.prototype.init = async function (this: NestApplicationContext) {
			if (this.appOptions[FORGE_PATCH_ENABLE_INIT] === false) {
				return this;
			}

			return originalInit.call(this);
		};
	}
}

type IEntryNestModule = Type<any> | DynamicModule | ForwardReference | Promise<IEntryNestModule>;
type Instrument = { instanceDecorator: (instance: unknown) => unknown };
type ForgeExtensionConstructor = new (...args: any[]) => ForgeExtension;
type NonNullableFields<T> = {
	[P in keyof T]-?: NonNullable<T[P]>;
};

interface InstrumentResponse {
	instances: ForgeBaseComponent[];
	instanceDecorator: (instance: unknown) => any;
}

interface ExtensionMetadata extends NonNullableFields<ModuleMetadata> {
	extensions: ForgeExtensionResolvable[];
}

/**
 * @internal
 */
export interface IForgeRootModule {
	moduleRef: ModuleRef;
}

const forge = new Forge();

export { forge as Forge };
