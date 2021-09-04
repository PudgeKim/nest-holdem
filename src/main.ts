import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import * as cookieParser from 'cookie-parser';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { ValidationPipe } from '@nestjs/common';
import { RedisIoAdapter } from './game/redis.adapter';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.use(cookieParser());
  app.enableCors({
    origin: true,
    credentials: true,
  });
  app.useGlobalPipes(new ValidationPipe());
  app.useWebSocketAdapter(new RedisIoAdapter(app));

  const swaggerConfig = new DocumentBuilder()
    .setTitle('Texas-Holdem API')
    .setDescription('Texas-Holdem API description')
    .setVersion('1.0')
    .addTag('Holdem')
    .build();
  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('api', app, document);

  await app.listen(parseInt(process.env.APP_PORT));
}
bootstrap();
