/**
 * forum-content.js - Extension entry point for forum thread pages
 * Lightweight script for forum features like featured post consolidation.
 */

// Import forum features
import './features/featured-posts.js';
import './features/user-muting.js';
import './features/reaction-filter.js';
import './features/disruptive-guest-filter.js';
// Note: attachment-exif-strip runs separately at document_start via manifest

console.log('[SNEED] Forum content script loaded');
