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
	 * The metdata for this extension.
	 */
	private readonly _metadata: ForgeExtensionMetadata;

	/**
	 * Constructs a new forge extension instance.
	 */
	public constructor(options?: ForgeExtensionMetadata) {
		this._metadata = options || {};
	}

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
	 * Returns the metadata for this extension.
	 */
	public getMetadata() {
		return this._metadata;
	}
}

export interface ForgeExtensionMetadata extends ModuleMetadata {
	/**
	 * An optional array of nested extensions to import.
	 */
	extensions?: ForgeExtensionResolvable[];
}

export type ForgeExtensionResolvable = ForgeExtension | (new () => ForgeExtension) | null | undefined | false;

export type ForgeHttpAdapterLike = AbstractHttpAdapter | null | undefined | Promise<AbstractHttpAdapter | null | undefined>;
