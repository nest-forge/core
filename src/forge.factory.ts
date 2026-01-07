import { DynamicModule, ForwardReference, MiddlewareConsumer, Module, ModuleMetadata, Type } from '@nestjs/common';
import { ForgeApplicationContextOptions, ForgeApplicationOptions } from './forge-options.interface';
import { ForgeExtension, ForgeExtensionResolvable } from './extensions';
import { NestFactory } from '@nestjs/core';

class Forge {
	public async create(appModule: IEntryNestModule, options?: ForgeApplicationOptions) {
		const extensions = this.discoverExtensions(options?.extensions ?? []);
		const root = this.createRootModule(appModule, extensions);
		const app = await NestFactory.create(root, {
			...options,
			instrument: this.createInstrument(extensions, options.instrument),
		});

		for (const extension of extensions) {
			extension.configureHttpApplication(app);
		}

		return app;
	}

	public async createApplicationContext(appModule: IEntryNestModule, options: ForgeApplicationContextOptions) {
		const extensions = this.discoverExtensions(options?.extensions ?? []);
		const root = this.createRootModule(appModule, extensions);
		const app = await NestFactory.createApplicationContext(root, {
			...options,
			instrument: this.createInstrument(extensions, options.instrument),
		});

		for (const extension of extensions) {
			extension.configureStandaloneApplication(app);
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
			imports: [appModule as any],
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

		@Module(meta)
		class ForgeRootModule {
			public configure(consumer: MiddlewareConsumer) {
				for (const extension of extensions) {
					extension.configureRootModule(consumer);
				}
			}
		}

		return ForgeRootModule;
	}

	protected createInstrument(extensions: ForgeExtension[], originalInstrument?: Instrument): Instrument {
		const hasOriginalInstrument = originalInstrument && originalInstrument.instanceDecorator;

		return {
			instanceDecorator(instance) {
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
}

type IEntryNestModule = Type<any> | DynamicModule | ForwardReference | Promise<IEntryNestModule>;
type Instrument = { instanceDecorator: (instance: unknown) => unknown };
type ForgeExtensionConstructor = new (...args: any[]) => ForgeExtension;

const forge = new Forge();

export { forge as Forge };
