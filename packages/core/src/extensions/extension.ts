import {
	INestApplication,
	INestApplicationContext,
	INestMicroservice,
	MiddlewareConsumer,
	ModuleMetadata,
	NestApplicationOptions,
} from '@nestjs/common';
import { ForgeBaseComponent, ForgeController, ForgeModule, ForgeService } from '../architecture';
import { NestApplicationContextOptions } from '@nestjs/common/interfaces/nest-application-context-options.interface';
import { NestMicroserviceOptions } from '@nestjs/common/interfaces/microservices/nest-microservice-options.interface';
import { AbstractHttpAdapter } from '@nestjs/core';

export abstract class ForgeExtension {
	/**
	 * Configures the HTTP adapter to use for the Nest application instance.
	 *
	 * @param current The current adapter instance, or `undefined` if not set (default will be used).
	 */
	public configureHttpAdapter(current?: AbstractHttpAdapter): ForgeHttpAdapterLike {
		return;
	}

	/**
	 * Configures a Nest application instance.
	 */
	public configureHttpApplication(application: INestApplication): any {}

	/**
	 * Configures the options object for a Nest application instance.
	 */
	public configureHttpApplicationOptions(options: NestApplicationOptions): NestApplicationOptions | Promise<NestApplicationOptions> {
		return options;
	}

	/**
	 * Configures a Nest application context. This is for a standalone application that has no web server.
	 */
	public configureStandaloneApplication(context: INestApplicationContext): any {}

	/**
	 * Configures the options object for a standalone Nest application instance.
	 */
	public configureStandaloneApplicationOptions(
		options: NestApplicationContextOptions
	): NestApplicationContextOptions | Promise<NestApplicationContextOptions> {
		return options;
	}

	/**
	 * Configures a Nest microservice context.
	 */
	public configureMicroserviceApplication(context: INestMicroservice): any {}

	/**
	 * Configures the options object for a Nest microservice instance.
	 */
	public configureMicroserviceApplicationOptions(
		options: NestMicroserviceOptions
	): NestMicroserviceOptions | Promise<NestMicroserviceOptions> {
		return options;
	}

	/**
	 * Configures the root module of the application.
	 */
	public configureRootModule(consumer: MiddlewareConsumer): any {}

	/**
	 * Runs after all services in the application have booted.
	 */
	public afterBoot(app: INestApplicationContext): any {}

	/**
	 * Instruments the application context. If a value is returned, the instance is replaced with that value, and no further extensions are
	 * queried.
	 */
	public instrument(instance: unknown): any {}

	/**
	 * Augments a `ForgeBaseComponent` instance.
	 */
	public augmentComponent(instance: ForgeBaseComponent, moduleRef: any): any {}

	/**
	 * Augments a `ForgeModule` instance.
	 */
	public augmentModule(instance: ForgeModule, moduleRef: any): any {}

	/**
	 * Augments a `ForgeController` instance.
	 */
	public augmentController(instance: ForgeController, moduleRef: any): any {}

	/**
	 * Augments a `ForgeService` instance.
	 */
	public augmentService(instance: ForgeService, moduleRef: any): any {}

	/**
	 * Returns an array of imports to add onto the root module.
	 */
	public getRootImports(): ModuleImport[] {
		return [];
	}

	/**
	 * Returns an array of providers to add onto the root module.
	 */
	public getRootProviders(): ModuleProvider[] {
		return [];
	}

	/**
	 * Returns an array of controllers to add onto the root module.
	 */
	public getRootControllers(): ModuleController[] {
		return [];
	}

	/**
	 * Returns an array of exports to add onto the root module.
	 */
	public getRootExports(): ModuleExport[] {
		return [];
	}

	/**
	 * Returns an array of nested extensions that will be imported along with this one.
	 */
	public getNestedExtensions(): ForgeExtensionResolvable[] {
		return [];
	}
}

export type ModuleImport = NonNullable<ModuleMetadata['imports']>[number];
export type ModuleProvider = NonNullable<ModuleMetadata['providers']>[number];
export type ModuleController = NonNullable<ModuleMetadata['controllers']>[number];
export type ModuleExport = NonNullable<ModuleMetadata['exports']>[number];

export type ForgeExtensionResolvable = ForgeExtension | (new () => ForgeExtension) | null | undefined | false;
export type ForgeHttpAdapterLike = AbstractHttpAdapter | null | undefined | Promise<AbstractHttpAdapter | null | undefined>;
