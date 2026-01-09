import { DynamicModule, ForwardReference, Global, MiddlewareConsumer, Module, ModuleMetadata, Type } from '@nestjs/common';
import { ForgeApplicationContextOptions, ForgeApplicationOptions, ForgeMicroserviceOptions } from './forge-options.interface';
import { ForgeExtension, ForgeExtensionResolvable } from './extensions';
import { ModuleRef, NestFactory } from '@nestjs/core';
import { FORGE_FIELD_MODULE_REF, FORGE_ROOT_MODULE, FORGE_TOKEN_ROOT_MODULE } from './constants';
import { ForgeBaseComponent, ForgeController, ForgeModule, ForgeService } from './architecture';

class Forge {
	private _augmented = new Set<ForgeBaseComponent>();

	public async create(appModule: IEntryNestModule, options?: ForgeApplicationOptions) {
		const extensions = this.discoverExtensions(options?.extensions ?? []);
		const root = this.createRootModule(appModule, extensions);
		const instrument = this.createInstrument(extensions, options.instrument);

		const app = await NestFactory.create(root, {
			...options,
			instrument: {
				instanceDecorator: instrument.instanceDecorator,
			},
		});

		await this.augmentComponents(instrument.instances, extensions);

		for (const extension of extensions) {
			await extension.configureHttpApplication(app);
		}

		return app;
	}

	public async createApplicationContext(appModule: IEntryNestModule, options: ForgeApplicationContextOptions) {
		const extensions = this.discoverExtensions(options?.extensions ?? []);
		const root = this.createRootModule(appModule, extensions);
		const instrument = this.createInstrument(extensions, options.instrument);

		const app = await NestFactory.createApplicationContext(root, {
			...options,
			instrument: {
				instanceDecorator: instrument.instanceDecorator,
			},
		});

		await this.augmentComponents(instrument.instances, extensions);

		for (const extension of extensions) {
			await extension.configureStandaloneApplication(app);
		}

		return app;
	}

	public async createMicroservice<T extends object>(appModule: IEntryNestModule, options: ForgeMicroserviceOptions & T) {
		const extensions = this.discoverExtensions(options?.extensions ?? []);
		const root = this.createRootModule(appModule, extensions);
		const instrument = this.createInstrument(extensions, options.instrument);

		const app = await NestFactory.createMicroservice<T>(root, {
			...options,
			instrument: {
				instanceDecorator: instrument.instanceDecorator,
			},
		});

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
				const metadata = extension.getMetadata();

				for (const nestedExtension of this.discoverExtensions(metadata.extensions)) {
					extensions.delete(nestedExtension.constructor as ForgeExtensionConstructor);
					extensions.set(nestedExtension.constructor as ForgeExtensionConstructor, nestedExtension);
				}

				extensions.delete(extension.constructor as ForgeExtensionConstructor);
				extensions.set(extension.constructor as ForgeExtensionConstructor, extension);
			}
		}

		return Array.from(extensions.values());
	}

	protected resolveExtension(resolvable: ForgeExtensionResolvable): ForgeExtension {
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

	protected createRootModule(appModule: IEntryNestModule, extensions: ForgeExtension[]) {
		const meta: ModuleMetadata = {
			imports: [],
			controllers: [],
			providers: [],
			exports: [],
		};

		for (const extension of extensions) {
			const extensionMeta = extension.getMetadata();

			meta.imports.push(...(extensionMeta.imports ?? []));
			meta.controllers.push(...(extensionMeta.controllers ?? []));
			meta.providers.push(...(extensionMeta.providers ?? []));
			meta.exports.push(...(extensionMeta.exports ?? []));
		}

		meta.imports.push(appModule as any);

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
			],
			exports: [FORGE_TOKEN_ROOT_MODULE],
		})
		class ForgeRootProviderModule {}

		meta.imports.unshift(ForgeRootProviderModule);

		return ForgeRootModule;
	}

	protected createInstrument(extensions: ForgeExtension[], originalInstrument?: Instrument): InstrumentResponse {
		const hasOriginalInstrument = originalInstrument && originalInstrument.instanceDecorator;
		const instances = new Array<ForgeBaseComponent>();

		return {
			instances,
			instanceDecorator: async (instance) => {
				if (this._isRootModule(instance)) {
					// TODO
				}

				if (instance instanceof ForgeBaseComponent) {
					instances.push(instance);
				}

				for (const extension of extensions) {
					const response = await extension.instrument(instance);

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
}

type IEntryNestModule = Type<any> | DynamicModule | ForwardReference | Promise<IEntryNestModule>;
type Instrument = { instanceDecorator: (instance: unknown) => unknown };
type ForgeExtensionConstructor = new (...args: any[]) => ForgeExtension;

interface InstrumentResponse {
	instances: ForgeBaseComponent[];
	instanceDecorator: (instance: unknown) => any;
}

/**
 * @internal
 */
export interface IForgeRootModule {
	moduleRef: ModuleRef;
}

const forge = new Forge();

export { forge as Forge };
