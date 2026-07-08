import { Module } from '@nestjs/common';
import { PlaygroundController } from './playground.controller';
import { AIModule } from '../../ai/ai.module';

@Module({
  imports: [AIModule],
  controllers: [PlaygroundController],
})
export class PlaygroundModule {}
