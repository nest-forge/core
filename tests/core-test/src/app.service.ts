import { ForgeService } from '@nest-forge/core';
import { Injectable } from '@nestjs/common';

@Injectable()
export class AppService extends ForgeService {
	constructor() {
		super();
	}

	public getHello(): string {
		return 'Hello World!';
	}
}
