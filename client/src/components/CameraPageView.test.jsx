import { renderWithTheme as render, screen, waitFor, within } from '../test/renderWithTheme.jsx';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import CameraPageView from './CameraPageView.jsx';

const timeline = {
  segments: [
    {
      id: 'seg-1',
      startLocal: '2026-06-08T14:30:00.000Z',
      endLocal: '2026-06-08T14:35:00.000Z',
      mtime: '2026-06-08T14:30:00.000Z',
      startLocalDisplay: 'Jun 8, 2026, 2:30:00 PM',
      sizeBytes: 1024,
      durationSec: 300,
    },
    {
      id: 'seg-2',
      startLocal: '2026-06-08T14:35:00.000Z',
      endLocal: '2026-06-08T14:40:00.000Z',
      mtime: '2026-06-08T14:35:00.000Z',
      startLocalDisplay: 'Jun 8, 2026, 2:35:00 PM',
      sizeBytes: 1024,
      durationSec: 300,
    },
    {
      id: 'seg-3',
      startLocal: '2026-06-08T14:40:00.000Z',
      endLocal: '2026-06-08T14:45:00.000Z',
      mtime: '2026-06-08T14:40:00.000Z',
      startLocalDisplay: 'Jun 8, 2026, 2:40:00 PM',
      sizeBytes: 1024,
      durationSec: 300,
    },
  ],
  rangeStart: '2026-06-08T14:30:00.000Z',
  rangeEnd: '2026-06-08T14:45:00.000Z',
};

vi.mock('../api.js', () => ({
  api: {
    getTimeline: vi.fn(),
    liveUrl: (id) => `/live/${id}/index.m3u8`,
    recordingUrl: (id) => `/api/recordings/${id}`,
    startLive: vi.fn(),
    stopLive: vi.fn(),
    startRecording: vi.fn(),
    stopRecording: vi.fn(),
    startCamera: vi.fn(),
    stopCamera: vi.fn(),
    deleteRecording: vi.fn(),
  },
  formatLocalTime: (iso) => iso || '—',
}));

vi.mock('./LivePlayer.jsx', () => ({
  default: () => <div data-testid="live-player" />,
}));

vi.mock('./DVRPlayer.jsx', () => ({
  default: ({ onGoLive }) => (
    <div data-testid="dvr-player">
      <button type="button" onClick={onGoLive}>Go Live</button>
    </div>
  ),
}));

vi.mock('./Timeline.jsx', () => ({
  default: ({ onSelect, segments, selectedId }) => (
    <div data-testid="timeline">
      <span data-testid="timeline-selected">{selectedId || 'none'}</span>
      {segments.map((seg) => (
        <button key={seg.id} type="button" onClick={() => onSelect(seg)}>
          Select {seg.id}
        </button>
      ))}
    </div>
  ),
}));

const baseCamera = {
  id: 'cam-1',
  name: 'C120',
  rtspUrl: 'rtsp://example/stream',
  status: 'live',
  recording: false,
  startedAt: '2026-06-08T14:00:00.000Z',
  error: null,
};

function renderPage(overrides = {}) {
  const handlers = {
    setCameras: vi.fn(),
    refreshCameras: vi.fn().mockResolvedValue(undefined),
    onRequestRemove: vi.fn(),
    onSegmentDeleted: vi.fn(),
    onOpenSegmentTab: vi.fn(),
    onTabGoLive: vi.fn(),
    getPlaybackPosition: vi.fn(() => 0),
    onPlaybackPositionChange: vi.fn(),
    ...(overrides.handlers || {}),
  };

  const view = render(
    <CameraPageView
      camera={baseCamera}
      {...handlers}
      {...overrides}
    />,
  );

  return { ...view, handlers };
}

describe('CameraPageView', () => {
  beforeEach(async () => {
    const { api } = await import('../api.js');
    api.getTimeline.mockResolvedValue(timeline);
  });

  it('shows the live player on a live camera tab', async () => {
    renderPage();

    await waitFor(() => {
      expect(screen.getByTestId('live-player')).toBeInTheDocument();
    });
  });

  it('opens a segment tab when a segment is selected', async () => {
    const user = userEvent.setup();
    const { handlers } = renderPage();

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Select seg-1' })).toBeInTheDocument();
    });

    await user.click(screen.getByRole('button', { name: 'Select seg-1' }));
    expect(handlers.onOpenSegmentTab).toHaveBeenCalledWith(timeline.segments[0]);
  });

  it('clears timeline selection while in live mode', async () => {
    renderPage();

    await waitFor(() => {
      expect(screen.getByTestId('timeline-selected')).toHaveTextContent('none');
    });
  });

  it('converts a segment tab to live and notifies the app', async () => {
    const user = userEvent.setup();
    const segment = timeline.segments[0];
    const { handlers } = renderPage({
      initialSegment: segment,
      isSegmentTab: true,
      tabId: 'tab-seg-1',
      camera: { ...baseCamera, status: 'idle', recording: false },
    });

    await waitFor(() => {
      expect(screen.getByTestId('dvr-player')).toBeInTheDocument();
    });

    await user.click(screen.getByRole('button', { name: 'Go Live' }));
    expect(handlers.onTabGoLive).toHaveBeenCalledWith('tab-seg-1');
  });

  it('asks for confirmation before deleting a segment in playback', async () => {
    const user = userEvent.setup();
    const segment = timeline.segments[0];
    const { handlers } = renderPage({
      initialSegment: segment,
      isSegmentTab: true,
      tabId: 'tab-seg-1',
      camera: { ...baseCamera, status: 'idle', recording: false },
    });

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Delete Segment' })).toBeInTheDocument();
    });

    await user.click(screen.getByRole('button', { name: 'Delete Segment' }));
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByText(/are you sure you want to delete/i)).toBeInTheDocument();
    expect(handlers.onSegmentDeleted).not.toHaveBeenCalled();

    const { api } = await import('../api.js');
    api.deleteRecording.mockResolvedValue({ ok: true, id: segment.id });

    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Delete Segment' }));
    await waitFor(() => {
      expect(api.deleteRecording).toHaveBeenCalledWith(segment.id);
      expect(handlers.onSegmentDeleted).toHaveBeenCalledWith(segment);
    });
  });

  it('opens the most recently finished segment in a new tab from the live tab', async () => {
    const user = userEvent.setup();
    const { api } = await import('../api.js');
    api.getTimeline.mockResolvedValue(timeline);
    const { handlers } = renderPage({
      camera: { ...baseCamera, recording: true },
    });

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Playback' })).toBeEnabled();
    });

    await user.click(screen.getByRole('button', { name: 'Playback' }));

    expect(handlers.onOpenSegmentTab).toHaveBeenCalledWith(timeline.segments[1]);
    expect(screen.getByTestId('live-player')).toBeInTheDocument();
  });

  it('disables playback on the live tab when only an in-progress segment exists', async () => {
    const { api } = await import('../api.js');
    api.getTimeline.mockResolvedValue({
      segments: [timeline.segments[1]],
      rangeStart: timeline.rangeStart,
      rangeEnd: timeline.rangeEnd,
    });

    renderPage({
      camera: { ...baseCamera, recording: true },
    });

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Playback' })).toBeDisabled();
    });
  });

  it('restores playback on a segment tab', async () => {
    const user = userEvent.setup();
    const segment = timeline.segments[0];

    renderPage({
      initialSegment: segment,
      isSegmentTab: true,
      tabId: 'tab-seg-1',
      camera: { ...baseCamera, status: 'live', recording: false },
    });

    await user.click(screen.getByRole('button', { name: 'Live' }));
    await user.click(screen.getByRole('button', { name: 'Playback' }));

    await waitFor(() => {
      expect(screen.getByTestId('dvr-player')).toBeInTheDocument();
      expect(screen.getByTestId('timeline-selected')).toHaveTextContent('seg-1');
    });
  });
});
