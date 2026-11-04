import { Dialog } from './dialog';

describe('Dialog', () => {
  let dialog: Dialog;

  beforeEach(() => {
    dialog = new Dialog();
  });

  it('confirm resolves true on answer(true path)', async () => {
    const p = dialog.confirm('Title', 'Message');
    expect(dialog.state()).toBeTruthy();
    dialog.answer('ok');
    await expect(p).resolves.toBe(true);
    expect(dialog.state()).toBeNull();
  });

  it('confirm resolves false on cancel', async () => {
    const p = dialog.confirm('Title', 'Message');
    dialog.answer(null);
    await expect(p).resolves.toBe(false);
  });

  it('prompt resolves the typed value', async () => {
    const p = dialog.prompt('Title', { placeholder: 'https://…' });
    dialog.answer('https://example.com');
    await expect(p).resolves.toBe('https://example.com');
  });

  it('prompt resolves null on cancel', async () => {
    const p = dialog.prompt('Title');
    dialog.answer(null);
    await expect(p).resolves.toBeNull();
  });

  it('queues a second request instead of cancelling the first', async () => {
    const first = dialog.confirm('First', 'm');
    const second = dialog.confirm('Second', 'm');
    expect(dialog.state()?.title).toBe('First');
    dialog.answer('ok');
    await expect(first).resolves.toBe(true);
    expect(dialog.state()?.title).toBe('Second');
    dialog.answer(null);
    await expect(second).resolves.toBe(false);
  });

  it('applies default confirm labels per kind', () => {
    dialog.alert('Title', 'm', { kind: 'success' });
    expect(dialog.state()?.confirmLabel).toBe('OK');
    expect(dialog.state()?.mode).toBe('alert');
  });
});
