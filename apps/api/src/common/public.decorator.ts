import { SetMetadata } from '@nestjs/common';

export const IS_PUBLIC = 'kp:isPublic';

/** Marks a controller or route as reachable without the service token and rate limit. */
export const Public = (): ClassDecorator & MethodDecorator => SetMetadata(IS_PUBLIC, true);
