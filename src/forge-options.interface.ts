import { NestApplicationOptions } from '@nestjs/common';
import { ForgeExtensionResolvable } from './extensions';
import { NestApplicationContextOptions } from '@nestjs/common/interfaces/nest-application-context-options.interface';
import { NestMicroserviceOptions } from '@nestjs/common/interfaces/microservices/nest-microservice-options.interface';

export interface ForgeApplicationOptions extends NestApplicationOptions {
	extensions?: ForgeExtensionResolvable | ForgeExtensionResolvable[];
}

export interface ForgeApplicationContextOptions extends NestApplicationContextOptions {
	extensions?: ForgeExtensionResolvable | ForgeExtensionResolvable[];
}

export interface ForgeMicroserviceOptions extends NestMicroserviceOptions {
	extensions?: ForgeExtensionResolvable | ForgeExtensionResolvable[];
}
