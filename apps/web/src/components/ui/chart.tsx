'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';
import * as RechartsPrimitive from 'recharts';

// Format: { THEME_NAME: CSS_SELECTOR }
const THEMES = { light: '', dark: '.dark' } as const;

const INITIAL_DIMENSION = { width: 320, height: 200 } as const;

export type ChartConfig = Record<
  string,
  {
    label?: React.ReactNode;
    icon?: React.ComponentType;
  } & (
    | { color?: string; theme?: never }
    | { color?: never; theme: Record<keyof typeof THEMES, string> }
  )
>;

type ChartContextProps = {
  config: ChartConfig;
};

const ChartContext = React.createContext<ChartContextProps | null>(null);

function useChart() {
  const context = React.useContext(ChartContext);

  if (!context) {
    throw new Error('useChart must be used within a <ChartContainer />');
  }

  return context;
}

function ChartContainer({
  id,
  className,
  children,
  config,
  initialDimension = INITIAL_DIMENSION,
  ...props
}: React.ComponentProps<'div'> & {
  config: ChartConfig;
  children: React.ComponentProps<typeof RechartsPrimitive.ResponsiveContainer>['children'];
  initialDimension?: {
    width: number;
    height: number;
  };
}) {
  const uniqueId = React.useId();
  const chartId = `chart-${id ?? uniqueId.replace(/:/g, '')}`;

  return (
    <ChartContext.Provider value={{ config }}>
      <div
        data-slot="chart"
        data-chart={chartId}
        className={cn(
          "flex aspect-video justify-center text-xs [&_.recharts-cartesian-axis-tick_text]:fill-muted-foreground [&_.recharts-cartesian-grid_line[stroke='#ccc']]:stroke-border/50 [&_.recharts-curve.recharts-tooltip-cursor]:stroke-border [&_.recharts-dot[stroke='#fff']]:stroke-transparent [&_.recharts-layer]:outline-hidden [&_.recharts-polar-grid_[stroke='#ccc']]:stroke-border [&_.recharts-radial-bar-background-sector]:fill-muted [&_.recharts-rectangle.recharts-tooltip-cursor]:fill-muted [&_.recharts-reference-line_[stroke='#ccc']]:stroke-border [&_.recharts-sector]:outline-hidden [&_.recharts-sector[stroke='#fff']]:stroke-transparent [&_.recharts-surface]:outline-hidden",
          className,
        )}
        {...props}
      >
        <ChartStyle id={chartId} config={config} />
        <RechartsPrimitive.ResponsiveContainer initialDimension={initialDimension}>
          {children}
        </RechartsPrimitive.ResponsiveContainer>
      </div>
    </ChartContext.Provider>
  );
}

const ChartStyle = ({ id, config }: { id: string; config: ChartConfig }) => {
  const colorConfig = Object.entries(config).filter(([, config]) => config.theme ?? config.color);

  if (!colorConfig.length) {
    return null;
  }

  return (
    <style
      dangerouslySetInnerHTML={{
        __html: Object.entries(THEMES)
          .map(
            ([theme, prefix]) => `
${prefix} [data-chart=${id}] {
${colorConfig
  .map(([key, itemConfig]) => {
    const color = itemConfig.theme?.[theme as keyof typeof itemConfig.theme] ?? itemConfig.color;
    return color ? `  --color-${key}: ${color};` : null;
  })
  .join('\n')}
}
`,
          )
          .join('\n'),
      }}
    />
  );
};

const ChartTooltip = RechartsPrimitive.Tooltip;

// Narrow Recharts' external payload before reading values in product UI.
function seriesKey(value: unknown) {
  return typeof value === 'string' || typeof value === 'number' ? String(value) : '';
}
function tooltipSeries(payload: readonly unknown[] | undefined) {
  return (payload ?? []).flatMap((item) => {
    if (!item || typeof item !== 'object' || !('value' in item) || typeof item.value !== 'number')
      return [];
    const key = 'dataKey' in item ? seriesKey(item.dataKey) : '';
    const name = 'name' in item ? seriesKey(item.name) : key;
    const color = 'color' in item && typeof item.color === 'string' ? item.color : undefined;
    return [{ key, name, value: item.value, color }];
  });
}
function ChartTooltipContent({
  active,
  payload,
  label,
  labelFormatter,
  formatter,
}: {
  active?: boolean | undefined;
  payload?: readonly unknown[] | undefined;
  label?: unknown;
  labelFormatter?: (label: string) => React.ReactNode;
  formatter?: (value: number) => React.ReactNode;
}) {
  const { config } = useChart();
  const series = tooltipSeries(payload);
  const entries = new Map(Object.entries(config));
  if (!active || !series.length) return null;
  const title = seriesKey(label);
  return (
    <div className="grid min-w-44 gap-2 rounded-lg border bg-popover px-3 py-2 text-xs shadow-md">
      {title && <div className="font-medium">{labelFormatter ? labelFormatter(title) : title}</div>}
      {series.map((item) => (
        <div key={item.key} className="flex items-center justify-between gap-5">
          <span className="flex items-center gap-2 text-muted-foreground">
            <span className="size-2 rounded-xs" style={{ backgroundColor: item.color }} />
            {entries.get(item.key)?.label ?? item.name}
          </span>
          <span className="font-medium tabular-nums">
            {formatter ? formatter(item.value) : item.value.toLocaleString('id-ID')}
          </span>
        </div>
      ))}
    </div>
  );
}
const ChartLegend = RechartsPrimitive.Legend;
function ChartLegendContent({ payload }: { payload?: readonly unknown[] | undefined }) {
  const { config } = useChart();
  const entries = new Map(Object.entries(config));
  return (
    <div className="flex flex-wrap justify-center gap-4 pt-3 text-xs">
      {(payload ?? []).map((item, index) => {
        if (!item || typeof item !== 'object') return null;
        const key = 'dataKey' in item ? seriesKey(item.dataKey) : '';
        const color = 'color' in item && typeof item.color === 'string' ? item.color : undefined;
        return (
          <span key={index} className="flex items-center gap-2">
            <span className="size-2 rounded-xs" style={{ backgroundColor: color }} />
            {entries.get(key)?.label ?? key}
          </span>
        );
      })}
    </div>
  );
}
export {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  ChartLegend,
  ChartLegendContent,
  ChartStyle,
};
