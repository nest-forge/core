import { Forge } from '@nest-forge/core';
import { AppModule } from './app.module';
import { LifecycleExtension } from './extensions/lifecycle.extension';

async function bootstrap() {
	const app = await Forge.create(AppModule, {
		extensions: [LifecycleExtension],
	});

	await app.listen(3000);
}

bootstrap().catch(console.error);
