import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { NestExpressApplication } from '@nestjs/platform-express';
import { join } from 'path';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  // API prefix
  app.setGlobalPrefix('api', { exclude: ['/'] });

  // Validation
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));

  // CORS for dev
  app.enableCors({ origin: true, credentials: true });

  // Serve frontend from /public
  app.useStaticAssets(join(__dirname, '..', 'public'));

  const port = process.env.PORT ?? 3000;
  await app.listen(port);
  console.log(`\n🀄  麻將伺服器啟動：http://localhost:${port}\n`);
}
bootstrap();
