import { Global, Module } from '@nestjs/common';
import { AvatarController } from './avatar.controller';
import { ImageSafetyService } from './image-safety.service';
import { PrivateMediaService } from './private-media.service';

@Global()
@Module({
  controllers: [AvatarController],
  providers: [ImageSafetyService, PrivateMediaService],
  exports: [ImageSafetyService, PrivateMediaService],
})
export class MediaModule {}
