import type { PlayerEvent } from './playerMessage';

/** Without player events: how long after the page load the picture counts as playing. */
export const LOAD_GRACE_MS = 2000;

export type Phase = 'idle' | 'starting' | 'playing' | 'error';
export type Notice = 'timeout' | 'ended' | 'waiting' | 'unreachable' | 'error' | 'notRunning';

/** What the player component renders. */
export interface StreamView {
    /** Where the stream stands. */
    phase: Phase;
    /** URL for the iframe, null while no player may be open. */
    iframeSrc: string | null;
    /** Show the snapshot over the player. */
    placeholder: boolean;
    /** Text to show, if any. */
    notice?: Notice;
    /** Camera name or error text for the notice. */
    detail?: string;
}

/** Settings and callbacks of a StreamController. */
export interface StreamControllerOptions {
    /** Opening the player starts the stream (eusec 3.4.0). */
    onDemand: boolean;
    /** stream.html posts events (eusec 3.4.0). */
    playerEvents: boolean;
    /** Player URL. */
    src: string;
    /** How long to wait for the stream before giving up. */
    startTimeoutMs: number;
    /** Writes a button state of the camera. */
    write: (name: 'start_stream' | 'stop_stream') => void;
    /** Receives every new view. */
    onView: (view: StreamView) => void;
}

/**
 * Starts, watches and stops the livestream of one widget. Never writes start_stream after
 * dispose(), and writes stop_stream only for a stream it started itself - another display may
 * be watching a stream someone else started.
 */
export class StreamController {
    private phase: Phase = 'idle';
    private iframeSrc: string | null = null;
    private placeholder = true;
    private notice: Notice | undefined;
    private detail: string | undefined;
    private visible = false;
    private alive = true;
    private live = false;
    private startedByMe = false;
    private disposed = false;
    private startTimer: ReturnType<typeof setTimeout> | undefined;
    private loadTimer: ReturnType<typeof setTimeout> | undefined;

    /** @param options Settings and callbacks */
    constructor(private readonly options: StreamControllerOptions) {}

    /** The widget became visible, or its dialog opened. */
    show(): void {
        if (this.disposed || this.visible) {
            return;
        }
        this.visible = true;
        this.start();
    }

    /** The widget is hidden, its dialog closed, or the page went to the background. */
    hide(): void {
        if (this.disposed || !this.visible) {
            return;
        }
        this.visible = false;
        this.stop();
        this.notice = undefined;
        this.detail = undefined;
        this.emit();
    }

    /** The retry button. */
    retry(): void {
        if (this.disposed || !this.visible || this.phase !== 'error') {
            return;
        }
        this.start();
    }

    /**
     * `system.adapter.eusec.N.alive` changed.
     *
     * @param alive New value
     */
    setAlive(alive: boolean): void {
        if (this.disposed || alive === this.alive) {
            return;
        }
        this.alive = alive;
        if (!this.visible) {
            return;
        }
        if (alive) {
            this.start();
        } else {
            this.fail('notRunning');
        }
    }

    /**
     * The `livestream` state became non-empty, or empty or deleted.
     *
     * @param active A stream runs
     */
    livestreamChanged(active: boolean): void {
        if (this.disposed) {
            return;
        }
        const was = this.live;
        this.live = active;
        // An on-demand player reconnects by itself; the state says nothing about this viewer.
        if (this.options.onDemand || !this.visible) {
            return;
        }
        if (active && this.phase === 'starting' && this.iframeSrc === null) {
            this.iframeSrc = this.options.src;
            this.emit();
            return;
        }
        if (!active && was && this.iframeSrc !== null) {
            // eusec ended the stream (maximum duration, station gone) - nothing left to stop.
            this.startedByMe = false;
            this.fail('ended');
        }
    }

    /**
     * An event of the own player, already filtered by readPlayerEvent().
     *
     * @param event The event
     */
    playerEvent(event: PlayerEvent): void {
        if (this.disposed || this.iframeSrc === null) {
            return;
        }
        switch (event.state) {
            case 'playing':
                this.clearTimers();
                this.phase = 'playing';
                this.placeholder = false;
                this.notice = undefined;
                this.detail = undefined;
                this.emit();
                break;
            case 'waiting':
            case 'unreachable':
                // The page asks again by itself; a station busy with another camera is no timeout.
                this.clearStartTimer();
                this.notice = event.state;
                this.detail = event.detail;
                this.emit();
                break;
            case 'error':
                this.fail('error', event.detail);
                break;
            default:
                // 'paused': the widget never pauses the element.
                break;
        }
    }

    /** The iframe fired load. Only used when the page sends no events. */
    iframeLoaded(): void {
        if (this.disposed || this.options.playerEvents || this.phase !== 'starting' || this.iframeSrc === null) {
            return;
        }
        clearTimeout(this.loadTimer);
        this.loadTimer = setTimeout(() => {
            this.loadTimer = undefined;
            if (this.phase === 'starting') {
                this.clearStartTimer();
                this.phase = 'playing';
                this.placeholder = false;
                this.emit();
            }
        }, LOAD_GRACE_MS);
    }

    /** The widget unmounts. Stops an own stream, then stays silent. */
    dispose(): void {
        if (this.disposed) {
            return;
        }
        this.stop();
        this.disposed = true;
    }

    private start(): void {
        this.clearTimers();
        this.notice = undefined;
        this.detail = undefined;
        this.placeholder = true;
        if (!this.alive) {
            this.fail('notRunning');
            return;
        }
        this.phase = 'starting';
        if (this.options.onDemand || this.live) {
            this.iframeSrc = this.options.src;
        } else {
            this.iframeSrc = null;
            this.startedByMe = true;
            this.options.write('start_stream');
        }
        this.startTimer = setTimeout(() => {
            this.startTimer = undefined;
            this.fail('timeout');
        }, this.options.startTimeoutMs);
        this.emit();
    }

    private stop(): void {
        this.clearTimers();
        this.iframeSrc = null;
        this.placeholder = true;
        this.phase = 'idle';
        if (this.startedByMe && !this.options.onDemand) {
            this.options.write('stop_stream');
        }
        this.startedByMe = false;
    }

    private fail(notice: Notice, detail?: string): void {
        this.stop();
        this.phase = 'error';
        this.notice = notice;
        this.detail = detail;
        this.emit();
    }

    private clearStartTimer(): void {
        clearTimeout(this.startTimer);
        this.startTimer = undefined;
    }

    private clearTimers(): void {
        this.clearStartTimer();
        clearTimeout(this.loadTimer);
        this.loadTimer = undefined;
    }

    private emit(): void {
        if (this.disposed) {
            return;
        }
        this.options.onView({
            phase: this.phase,
            iframeSrc: this.iframeSrc,
            placeholder: this.placeholder,
            notice: this.notice,
            detail: this.detail,
        });
    }
}
