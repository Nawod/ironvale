import 'fake-indexeddb/auto';
import {it,expect} from 'vitest';
import {writeSave,readSave} from '../src/storage';
it('keeps manual and rolling autosave slots separate',async()=>{await writeSave('manual','first');await writeSave('auto','second');await writeSave('auto','third');expect((await readSave('manual'))?.text).toBe('first');expect((await readSave('auto'))?.text).toBe('third');});
