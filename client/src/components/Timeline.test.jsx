import { act, renderWithTheme as render, screen } from '../test/renderWithTheme.jsx';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import Timeline from './Timeline.jsx';

const segments = [
  {
    id: 'cam-1/2026-06-08_14-30-00.mp4',
    startLocal: '2026-06-08T14:30:00.000Z',
    endLocal: '2026-06-08T14:35:00.000Z',
    mtime: '2026-06-08T14:30:00.000Z',
    startLocalDisplay: 'Jun 8, 2026, 2:30:00 PM',
    sizeBytes: 5 * 1024 * 1024,
    durationSec: 300,
  },
];

function renderTimeline(props = {}) {
  return render(
    <Timeline
      segments={segments}
      selectedId={null}
      onSelect={vi.fn()}
      rangeStart="2026-06-08T14:30:00.000Z"
      rangeEnd="2026-06-08T14:35:00.000Z"
      cameraId="cam-1"
      cameraName="C120"
      {...props}
    />,
  );
}

describe('Timeline', () => {
  it('shows an empty message when there are no recordings', () => {
    render(
      <Timeline
        segments={[]}
        selectedId={null}
        onSelect={vi.fn()}
        rangeStart={null}
        rangeEnd={null}
        cameraId="cam-1"
        cameraName="C120"
        segmentDurationSec={600}
      />,
    );

    expect(screen.getByText(/no recordings yet/i)).toBeInTheDocument();
    expect(screen.getByText(/segments are saved every 10 minutes/i)).toBeInTheDocument();
    expect(screen.getByText(/recordings older than 7 days are removed automatically/i)).toBeInTheDocument();
  });

  it('shows disabled cleanup copy when retention is zero', () => {
    render(
      <Timeline
        segments={[]}
        selectedId={null}
        onSelect={vi.fn()}
        rangeStart={null}
        rangeEnd={null}
        cameraId="cam-1"
        cameraName="C120"
        retentionDays={0}
      />,
    );

    expect(screen.getByText(/automatic cleanup is disabled/i)).toBeInTheDocument();
  });

  it('calls onSelect when a segment bar is clicked', async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();

    renderTimeline({ onSelect });

    await user.click(screen.getByRole('button', { name: /jun 8, 2026, 2:30:00 pm/i }));
    expect(onSelect).toHaveBeenCalledWith(segments[0]);
  });

  it('highlights the selected segment', () => {
    renderTimeline({ selectedId: segments[0].id });

    expect(document.querySelector('.timeline-segment.selected')).toBeTruthy();
  });

  it('renders timeline zoom controls', () => {
    renderTimeline();

    expect(screen.getByLabelText(/zoom in timeline/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/zoom out timeline/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/timeline zoom/i)).toBeInTheDocument();
    expect(screen.getByText('1×')).toBeInTheDocument();
  });

  it('zooms in when the zoom-in button is clicked', async () => {
    const user = userEvent.setup();
    renderTimeline();

    const track = document.querySelector('.timeline-bar-track');
    expect(track).toHaveStyle({ width: '100%' });

    await user.click(screen.getByLabelText(/zoom in timeline/i));

    expect(screen.getByText('1.5×')).toBeInTheDocument();
    expect(track).toHaveStyle({ width: '150%' });
    expect(document.querySelector('.timeline-bar-viewport.zoomed')).toBeTruthy();
  });

  it('disables zoom out at the minimum zoom level', () => {
    renderTimeline();

    expect(screen.getByLabelText(/zoom out timeline/i)).toBeDisabled();
  });

  it('shows a scrub marker for the selected segment playback time', () => {
    renderTimeline({
      selectedId: segments[0].id,
      playbackScrub: { segmentId: segments[0].id, timeSec: 90 },
    });

    expect(screen.getByText(/playing at/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/playback position at/i)).toBeInTheDocument();
    expect(document.querySelector('.timeline-scrub-marker')).toBeTruthy();
  });

  it('calls onScrubChange when dragging the selected segment', () => {
    const onScrubChange = vi.fn();
    renderTimeline({
      selectedId: segments[0].id,
      playbackScrub: { segmentId: segments[0].id, timeSec: 0 },
      onScrubChange,
    });

    const segment = document.querySelector('.timeline-segment.selected');
    expect(segment).toBeTruthy();

    segment.getBoundingClientRect = () => ({
      x: 100,
      y: 10,
      left: 100,
      top: 10,
      right: 300,
      bottom: 70,
      width: 200,
      height: 60,
      toJSON: () => ({}),
    });

    const track = document.querySelector('.timeline-bar-track');
    track.getBoundingClientRect = () => ({
      x: 0,
      y: 10,
      left: 0,
      top: 10,
      right: 400,
      bottom: 70,
      width: 400,
      height: 60,
      toJSON: () => ({}),
    });
    Object.defineProperty(track, 'offsetWidth', { value: 400, configurable: true });
    track.setPointerCapture = vi.fn();
    track.releasePointerCapture = vi.fn();

    act(() => {
      segment.dispatchEvent(new PointerEvent('pointerdown', {
        bubbles: true,
        cancelable: true,
        clientX: 150,
        pointerId: 1,
      }));
      track.dispatchEvent(new PointerEvent('pointermove', {
        bubbles: true,
        cancelable: true,
        clientX: 200,
        pointerId: 1,
      }));
      track.dispatchEvent(new PointerEvent('pointerup', {
        bubbles: true,
        cancelable: true,
        clientX: 200,
        pointerId: 1,
      }));
    });

    expect(onScrubChange).toHaveBeenCalled();
    const lastCall = onScrubChange.mock.calls[onScrubChange.mock.calls.length - 1];
    expect(lastCall[0]).toBe(segments[0].id);
    expect(lastCall[2]).toEqual({ final: true });
    expect(lastCall[1]).toBeCloseTo(150, 0);
  });
});
