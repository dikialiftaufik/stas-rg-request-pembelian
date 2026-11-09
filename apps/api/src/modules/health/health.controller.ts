import { Controller, Get } from '@nestjs/common';

@Controller('health')
export class HealthController {
  @Get()
  check(): { data: { status: 'ok'; service: '@stas/api' } } {
    return {
      data: {
        status: 'ok',
        service: '@stas/api',
      },
    };
  }
}
