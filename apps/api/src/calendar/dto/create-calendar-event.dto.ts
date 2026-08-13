import { IsIn, IsNotEmpty, IsString, Matches, MaxLength } from 'class-validator';
import type {
  CreateCalendarEventRequest,
  UserEventKind,
} from '@second-brain/shared';

const KINDS: UserEventKind[] = ['exam', 'objective', 'deadline'];

export class CreateCalendarEventDto implements CreateCalendarEventRequest {
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'date must be YYYY-MM-DD' })
  date!: string;

  @IsIn(KINDS)
  kind!: UserEventKind;

  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  title!: string;
}
