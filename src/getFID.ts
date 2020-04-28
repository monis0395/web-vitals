/*
 * Copyright 2020 Google Inc. All Rights Reserved.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import {bindReporter} from './lib/bindReporter.js';
import {initMetric} from './lib/initMetric.js';
import {observe, PerformanceEntryHandler} from './lib/observe.js';
import {onHidden} from './lib/onHidden.js';
import {ReportHandler} from './types.js';


interface FIDPolyfillCallback {
  (value: number, event: Event): void;
}

interface FIDPolyfill {
  onFirstInputDelay: (onReport: FIDPolyfillCallback) => void;
}

declare global {
  interface Window {
    perfMetrics: FIDPolyfill;
  }
}

// https://wicg.github.io/event-timing/#sec-performance-event-timing
interface PerformanceEventTiming extends PerformanceEntry {
  processingStart: number;
}

export const getFID = (onReport: ReportHandler) => {
  const metric = initMetric();

  const entryHandler = (entry: PerformanceEventTiming) => {
    metric.value = entry.processingStart - entry.startTime;
    metric.entries.push(entry);
    metric.isFinal = true;
    report();
  };

  const po = observe('first-input', entryHandler as PerformanceEntryHandler);
  const report = bindReporter(onReport, metric, po);

  onHidden(() => {
    if (po) {
      po.takeRecords().map(entryHandler as PerformanceEntryHandler);
      po.disconnect();
    }
  }, true);

  if (!po) {
    if (window.perfMetrics && window.perfMetrics.onFirstInputDelay) {
      window.perfMetrics.onFirstInputDelay((value: number, event: Event) => {
        metric.value = value;
        metric.event = event;
        metric.isFinal = true;
        report();
      });
    }
  }
};