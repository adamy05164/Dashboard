/**
 * RTWF Form -> Dashboard Connector
 *
 * Single source of truth for how a submitted intake form's JSON reaches
 * the partner dashboard. Replaces the old "copy JSON, open dashboard,
 * paste into Import modal" hand-off with an automatic one.
 *
 * Submission shape (built by pre_form.html / post_form.html, consumed by
 * importFormJson() in the dashboard):
 *   {
 *     formStage: "pre-meeting-screener" | "post-meeting-deep-dive",
 *     submittedAt: <ISO date string>,
 *     _submissionId: <string>,      // pre-meeting only — stable id for this partner
 *     _preSubmissionId: <string>,   // post-meeting only — links back to _submissionId above
 *     Contact / Account / Disease / Research / Funding / SupportNeeds / Materials / Meeting: {...}
 *   }
 *
 * Transport: a small localStorage queue, same-origin/same-browser only —
 * there is no backend in this app yet (see CONFIG.API_URL in each form).
 * A dashboard tab open in the same browser picks up a submission live via
 * the "storage" event; a dashboard opened later catches up by draining
 * the queue once on load.
 */
(function (global) {
  'use strict';
  var QUEUE_KEY = 'rtwf_pending_imports_v1';

  function readQueue() {
    try { return JSON.parse(localStorage.getItem(QUEUE_KEY) || '[]'); }
    catch (e) { return []; }
  }
  function writeQueue(list) {
    try { localStorage.setItem(QUEUE_KEY, JSON.stringify(list)); }
    catch (e) { /* private mode / quota — submission still lives in the form's own confirmation JSON */ }
  }

  // Called by a form right after it builds its JSON payload.
  function publish(rawJson) {
    var q = readQueue();
    q.push({ json: rawJson, queuedAt: new Date().toISOString() });
    writeQueue(q);
  }

  // Called by the dashboard on load to pick up anything queued while it
  // was closed. Returns the number of submissions handed to `handler`.
  function drain(handler) {
    var q = readQueue();
    if (!q.length) return 0;
    writeQueue([]);
    q.forEach(function (entry) { handler(entry.json); });
    return q.length;
  }

  // Called by the dashboard so it reacts the instant a form open in
  // another tab of the same browser publishes a submission — no reload.
  function onLive(handler) {
    global.addEventListener('storage', function (e) {
      if (e.key !== QUEUE_KEY || !e.newValue) return;
      drain(handler);
    });
  }

  global.RTWFConnector = { publish: publish, drain: drain, onLive: onLive };
})(window);
