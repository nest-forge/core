import { ForgeController } from '@nest-forge/core';
import { Controller, Get } from '@nestjs/common';
import { AppService } from './app.service';

@Controller()
export class AppController extends ForgeController {
	constructor(private readonly service: AppService) {
		super();
	}

	@Get()
	public getHello(): string {
		return this.service.getHello();
	}
}
