import { ForgeModule } from '@nest-forge/core';
import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';

@Module({
	imports: [],
	controllers: [AppController],
	providers: [AppService],
	exports: [AppService],
})
export class AppModule extends ForgeModule {}
