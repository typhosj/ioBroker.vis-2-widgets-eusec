import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { LOAD_GRACE_MS, StreamController, type StreamControllerOptions, type StreamView } from './streamControl';

const SRC = 'http://h:1984/stream.html?src=T8410P00';

function setup(options: Partial<StreamControllerOptions> = {}): {
    controller: StreamController;
    writes: string[];
    views: StreamView[];
    last: () => StreamView;
} {
    const writes: string[] = [];
    const views: StreamView[] = [];
    const controller = new StreamController({
        onDemand: false,
        playerEvents: true,
        src: SRC,
        startTimeoutMs: 30_000,
        write: name => writes.push(name),
        onView: view => views.push(view),
        ...options,
    });
    return { controller, writes, views, last: () => views[views.length - 1] };
}

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe('StreamController', () => {
    it('on demand: sets the player at once and writes nothing', () => {
        const { controller, writes, last } = setup({ onDemand: true });
        controller.show();
        expect(last()).toMatchObject({ phase: 'starting', iframeSrc: SRC, placeholder: true });
        controller.hide();
        expect(writes).toEqual([]);
    });

    it('without on demand: writes start_stream and sets the player only once the livestream runs', () => {
        const { controller, writes, last } = setup();
        controller.show();
        expect(writes).toEqual(['start_stream']);
        expect(last()).toMatchObject({ phase: 'starting', iframeSrc: null });
        controller.livestreamChanged(true);
        expect(last()).toMatchObject({ phase: 'starting', iframeSrc: SRC });
    });

    it('joins a livestream that already runs, and leaves it running', () => {
        const { controller, writes, last } = setup();
        controller.livestreamChanged(true);
        controller.show();
        expect(last().iframeSrc).toBe(SRC);
        controller.hide();
        expect(writes).toEqual([]);
    });

    it('hides the placeholder on the playing event', () => {
        const { controller, last } = setup({ onDemand: true });
        controller.show();
        controller.playerEvent({ state: 'playing' });
        expect(last()).toMatchObject({ phase: 'playing', placeholder: false, notice: undefined });
    });

    it('ignores player events while no player is set', () => {
        const { controller, last } = setup();
        controller.show();
        controller.playerEvent({ state: 'playing' });
        expect(last().phase).toBe('starting');
    });

    it('gives up after the start timeout and stops the stream it started', () => {
        const { controller, writes, last } = setup();
        controller.show();
        vi.advanceTimersByTime(30_000);
        expect(last()).toMatchObject({ phase: 'error', notice: 'timeout', iframeSrc: null });
        expect(writes).toEqual(['start_stream', 'stop_stream']);
    });

    it('stops its own stream on hide', () => {
        const { controller, writes } = setup();
        controller.show();
        controller.livestreamChanged(true);
        controller.hide();
        expect(writes).toEqual(['start_stream', 'stop_stream']);
    });

    it('reports a stream that eusec ended, without writing stop_stream', () => {
        const { controller, writes, last } = setup();
        controller.show();
        controller.livestreamChanged(true);
        controller.playerEvent({ state: 'playing' });
        controller.livestreamChanged(false);
        expect(last()).toMatchObject({ phase: 'error', notice: 'ended', iframeSrc: null, placeholder: true });
        expect(writes).toEqual(['start_stream']);
    });

    it('keeps waiting while the station is busy, without timing out', () => {
        const { controller, last } = setup({ onDemand: true });
        controller.show();
        controller.playerEvent({ state: 'waiting', detail: 'Garage' });
        vi.advanceTimersByTime(120_000);
        expect(last()).toMatchObject({ phase: 'starting', notice: 'waiting', detail: 'Garage' });
    });

    it('shows a player error', () => {
        const { controller, last } = setup({ onDemand: true });
        controller.show();
        controller.playerEvent({ state: 'error', detail: 'codec' });
        expect(last()).toMatchObject({ phase: 'error', notice: 'error', detail: 'codec', iframeSrc: null });
    });

    it('ignores paused', () => {
        const { controller, views } = setup({ onDemand: true });
        controller.show();
        const count = views.length;
        controller.playerEvent({ state: 'paused' });
        expect(views).toHaveLength(count);
    });

    it('without player events: counts the page load plus a grace period as playing', () => {
        const { controller, last } = setup({ onDemand: true, playerEvents: false });
        controller.show();
        controller.iframeLoaded();
        vi.advanceTimersByTime(LOAD_GRACE_MS - 1);
        expect(last().phase).toBe('starting');
        vi.advanceTimersByTime(1);
        expect(last()).toMatchObject({ phase: 'playing', placeholder: false });
    });

    it('with player events: ignores the page load', () => {
        const { controller, last } = setup({ onDemand: true });
        controller.show();
        controller.iframeLoaded();
        vi.advanceTimersByTime(LOAD_GRACE_MS);
        expect(last().phase).toBe('starting');
    });

    it('does not start while eusec is not running, and starts once it runs', () => {
        const { controller, writes, last } = setup();
        controller.setAlive(false);
        controller.show();
        expect(last()).toMatchObject({ phase: 'error', notice: 'notRunning' });
        expect(writes).toEqual([]);
        controller.setAlive(true);
        expect(writes).toEqual(['start_stream']);
    });

    it('stops when eusec goes down while playing', () => {
        const { controller, writes, last } = setup();
        controller.show();
        controller.setAlive(false);
        expect(last()).toMatchObject({ phase: 'error', notice: 'notRunning', iframeSrc: null });
        expect(writes).toEqual(['start_stream', 'stop_stream']);
    });

    it('starts again on retry', () => {
        const { controller, writes } = setup();
        controller.show();
        vi.advanceTimersByTime(30_000);
        controller.retry();
        expect(writes).toEqual(['start_stream', 'stop_stream', 'start_stream']);
    });

    it('after dispose: stops once, then never writes or reports again', () => {
        const { controller, writes, views } = setup();
        controller.show();
        controller.dispose();
        const count = views.length;
        controller.show();
        controller.livestreamChanged(true);
        controller.retry();
        vi.advanceTimersByTime(60_000);
        expect(writes).toEqual(['start_stream', 'stop_stream']);
        expect(views).toHaveLength(count);
    });
});
