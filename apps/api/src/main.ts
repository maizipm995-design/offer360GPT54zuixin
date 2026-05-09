import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import cookieParser from 'cookie-parser';
import { Request, Response } from 'express';
import { AppModule } from './app.module';
import { ResponseInterceptor } from './common/interceptors/response.interceptor';
import { env } from './config/env';
import { PrismaService } from './prisma.service';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    rawBody: true,
  });
  app.setGlobalPrefix('api');
  app.use(cookieParser());
  app.enableCors({
    origin: env.corsOrigin.split(','),
    credentials: true,
  });
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    }),
  );
  app.useGlobalInterceptors(new ResponseInterceptor());

  const expressApp = app.getHttpAdapter().getInstance();
  expressApp.get('/', (_req: Request, res: Response) => {
    res.json({
      name: 'offer360-api',
      status: 'ok',
      docs: '/api/docs',
      time: new Date().toISOString(),
    });
  });
  expressApp.get('/healthz', (_req: Request, res: Response) => {
    res.json({
      name: 'offer360-api',
      status: 'ok',
      time: new Date().toISOString(),
    });
  });

  const swaggerConfig = new DocumentBuilder()
    .setTitle('offer360 API')
    .setDescription('offer360 前后端对接接口文档')
    .setVersion('1.0.0')
    .addBearerAuth()
    .build();
  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('api/docs', app, document);

  const prismaService = app.get(PrismaService);
  await prismaService.enableShutdownHooks(app);

  await app.listen(env.port);
}

bootstrap();
