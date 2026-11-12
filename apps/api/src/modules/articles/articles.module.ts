import { Module } from '@nestjs/common';
import { ArticlesController } from './articles.controller.js';
import { ArticlesRepository } from './articles.repository.js';

@Module({ controllers: [ArticlesController], providers: [ArticlesRepository] })
export class ArticlesModule {}
