import { TestBed } from '@angular/core/testing';
import { Component, signal } from '@angular/core';

import { useScrollLock } from './scroll-lock';

@Component({ selector: 'app-lock-host', template: '' })
class LockHost {
  readonly active = signal(false);
  constructor() {
    useScrollLock(this.active);
  }
}

function create(): LockHost {
  const fixture = TestBed.createComponent(LockHost);
  fixture.detectChanges();
  return fixture.componentInstance;
}

describe('useScrollLock', () => {
  afterEach(() => {
    TestBed.resetTestingModule();
    document.body.style.overflow = '';
  });

  it('locks body scroll while active and restores it when inactive', () => {
    const host = create();
    host.active.set(true);
    TestBed.tick();
    expect(document.body.style.overflow).toBe('hidden');

    host.active.set(false);
    TestBed.tick();
    expect(document.body.style.overflow).toBe('');
  });

  it('keeps the lock until every active overlay has released it', () => {
    const a = create();
    const b = create();
    a.active.set(true);
    b.active.set(true);
    TestBed.tick();

    a.active.set(false);
    TestBed.tick();
    expect(document.body.style.overflow).toBe('hidden');

    b.active.set(false);
    TestBed.tick();
    expect(document.body.style.overflow).toBe('');
  });

  it('releases its lock when the owner is destroyed', () => {
    const fixture = TestBed.createComponent(LockHost);
    fixture.detectChanges();
    fixture.componentInstance.active.set(true);
    TestBed.tick();

    fixture.destroy();
    expect(document.body.style.overflow).toBe('');
  });
});
