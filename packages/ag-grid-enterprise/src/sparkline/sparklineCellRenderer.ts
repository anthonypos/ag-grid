import type { AgChartInstance, AgChartTheme, AgSparklineOptions, AgTooltipRendererResult } from 'ag-charts-types';

import type { ICellRenderer, ISparklineCellRendererParams } from 'ag-grid-community';
import { Component, RefPlaceholder, _observeResize } from 'ag-grid-community';

import { wrapFn } from './sparklinesUtils';

export class SparklineCellRenderer extends Component implements ICellRenderer {
    private readonly eSparkline: HTMLElement = RefPlaceholder;
    private sparklineInstance?: AgChartInstance<any>;
    private sparklineOptions: AgSparklineOptions;
    private params: ISparklineCellRendererParams<any, any> | undefined;

    constructor() {
        super(/* html */ `<div class="ag-sparkline-wrapper">
            <span data-ref="eSparkline"></span>
        </div>`);
    }

    public init(params: ISparklineCellRendererParams): void {
        this.refresh(params);
        const unsubscribeFromResize = _observeResize(this.beans, this.getGui(), () => this.refresh(params));
        this.addDestroyFunc(() => unsubscribeFromResize());
    }

    public refresh(params?: ISparklineCellRendererParams): boolean {
        this.params = params;
        const { clientWidth: width, clientHeight: height } = this.getGui();

        if (!this.sparklineInstance && params && width > 0 && height) {
            this.sparklineOptions = {
                container: this.eSparkline,
                width,
                height,
                ...params.sparklineOptions,
                data: this.processData(params.value),
            } as AgSparklineOptions;

            if (this.sparklineOptions.tooltip?.renderer) {
                this.wrapTooltipRenderer();
            } else {
                this.sparklineOptions.tooltip = {
                    ...this.sparklineOptions.tooltip,
                    renderer: (params: any) =>
                        ({ content: this.createDefaultContent(params) }) as AgTooltipRendererResult,
                };
            }

            // Only bar sparklines have itemStyler
            const theme = this.sparklineOptions?.theme as AgChartTheme;
            if (this.sparklineOptions.type === 'bar' && this.sparklineOptions.itemStyler) {
                this.wrapItemStyler(this.sparklineOptions);
            } else if (theme?.overrides?.bar?.series?.itemStyler) {
                this.wrapItemStyler(theme.overrides.bar.series);
            }

            // create new sparkline
            this.sparklineInstance = params.createSparkline!(this.sparklineOptions);
            return true;
        } else if (this.sparklineInstance) {
            const data = params?.value;
            this.sparklineOptions.width = width;
            this.sparklineOptions.height = height;
            this.sparklineOptions.data = this.processData(data);

            this.sparklineInstance.updateDelta(this.sparklineOptions);

            return true;
        }
        return false;
    }

    private processData(data: any[] = []) {
        if (data.length === 0) {
            return data;
        }

        return data.filter((item) => item != null);
    }

    private createContext() {
        return {
            data: this.params?.data,
            cellData: this.params?.value,
        };
    }

    private createDefaultContent(params: any) {
        return `${params.yValue}`;
    }

    private wrapItemStyler(container: { itemStyler?: any }) {
        container!.itemStyler = wrapFn(container.itemStyler, (fn, stylerParams: any): any => {
            return fn({
                ...stylerParams,
                context: this.createContext(),
            });
        });
    }

    private wrapTooltipRenderer() {
        this.sparklineOptions.tooltip = {
            ...this.sparklineOptions.tooltip,
            renderer: wrapFn(this.sparklineOptions.tooltip!.renderer!, (fn, tooltipParams: any): any => {
                const userResult = fn({
                    ...tooltipParams,
                    context: this.createContext(),
                });

                if (typeof userResult === 'string') {
                    return userResult;
                }
                return {
                    content: this.createDefaultContent(tooltipParams),
                    ...userResult,
                };
            }),
        };
    }

    public override destroy() {
        super.destroy();
        this.sparklineInstance?.destroy();
    }
}
