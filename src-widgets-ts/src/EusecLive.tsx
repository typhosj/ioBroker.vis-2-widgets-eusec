import React from 'react';
import type { RxRenderWidgetProps, RxWidgetInfo } from '@iobroker/types-vis-2';
import type VisRxWidget from '@iobroker/types-vis-2/visRxWidget';

import { LivePlayer } from './LivePlayer';
import { createInfo, deviceField, playerFields, playerProps } from './widgetInfo';

const Base: typeof VisRxWidget<Record<string, unknown>> = window.visRxWidget;

/** Livestream of one camera. */
export default class EusecLive extends Base {
    /** Attributes and name of the widget in the vis-2 editor. */
    static getWidgetInfo(): RxWidgetInfo {
        return createInfo('tplVis2EusecLive', 'live_widget', [deviceField, ...playerFields]);
    }

    /** Instance access to the static widget info, which vis-2 calls. */
    getWidgetInfo(): RxWidgetInfo {
        return EusecLive.getWidgetInfo();
    }

    /**
     * Renders the player.
     *
     * @param props Render props of vis-2
     */
    renderWidgetBody(props: RxRenderWidgetProps): React.JSX.Element {
        super.renderWidgetBody(props);
        const data = this.state.rxData;
        return (
            <LivePlayer
                socket={this.props.context.socket}
                channelId={data.device}
                active={!this.props.editMode}
                {...playerProps(data)}
            />
        );
    }
}
