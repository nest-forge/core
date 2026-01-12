import { ForgeBaseComponent, ForgeController, ForgeExtension, ForgeModule, ForgeService } from '@nest-forge/core';
import { INestApplication, INestApplicationContext, Logger, MiddlewareConsumer, NestApplicationOptions } from '@nestjs/common';
import { AbstractHttpAdapter } from '@nestjs/core';

/**
 * A simple extension that logs each method to preview the lifecycle.
 */
export class LifecycleExtension extends ForgeExtension {
	private readonly logger = new Logger('BasicExtension');

	configureHttpApplicationOptions(options: NestApplicationOptions) {
		this.logger.debug('configureHttpApplicationOptions');
		return options;
	}

	configureHttpAdapter(current?: AbstractHttpAdapter) {
		this.logger.debug('configureHttpAdapter');
		return current;
	}

	instrument(instance: any) {
		this.logger.verbose(`instrument: ${instance.constructor.name}`);
	}

	configureHttpApplication(application: INestApplication) {
		this.logger.debug('configureHttpApplication');
	}

	augmentComponent(instance: ForgeBaseComponent, moduleRef: any) {
		this.logger.verbose(`augmentComponent: ${instance.constructor.name}`);
	}

	augmentModule(instance: ForgeModule, moduleRef: any) {
		this.logger.verbose(`augmentModule: ${instance.constructor.name}`);
	}

	augmentService(instance: ForgeService, moduleRef: any) {
		this.logger.verbose(`augmentService: ${instance.constructor.name}`);
	}

	augmentController(instance: ForgeController, moduleRef: any) {
		this.logger.verbose(`augmentController: ${instance.constructor.name}`);
	}

	configureRootModule(consumer: MiddlewareConsumer) {
		this.logger.debug('configureRootModule');
	}

	afterBoot(app: INestApplicationContext) {
		this.logger.debug('afterBoot');
	}
}
