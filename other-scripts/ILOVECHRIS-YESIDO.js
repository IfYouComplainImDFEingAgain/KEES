// ==UserScript==
// @name         I LOVE CHRIS. YES I DO.
// @namespace    http://tampermonkey.net/
// @version      1.5
// @description  Automatically clicks the like button on DLive with random intervals (0.1-0.7s), clicks Close button if present, pauses for 5s after 190 clicks, stops at 6k stats count
// @author       Bossman
// @match        https://dlive.tv/djheartbeatz
// @grant        none
// ==/UserScript==

// THIS LITERALLY JUST CLICKS THE HEART BUTTON ON DLIVE TO GIVE CHRIS HIS 6k LIKES YOU FUCKING NONCES

// ====================================================================
// LICENSE AGREEMENT
// By using this script, you hereby acknowledge and declare that:
// You luv Chris
// Roobeh is a SLAG
// Rooben is a CUNT
// IT WAS A DODGY LINK
// 
// ====================================================================

// ====================================================================
// SAFETY NOTE FOR NON-PROGRAMMERS:
// This script ONLY does the following:
// 1. Finds and clicks the like button on DLive
// 2. Reads the stats counter on the page to know when to stop
// 3. Clicks "Close" on the rate limiting pop up
// 4. Stops clicking when Chris reaches 6k likes
// YOU MUST BE LOGGED IN FOR THIS TO WORK
//
// This script does NOT:
// - Access or steal passwords
// - Access or steal personal information
// - Send any data to external servers
// - Access your browser history, cookies, or saved data
// - Do anything outside of the DLive page you're viewing
//
// You can verify this by reading through the code below.
// All it does is click buttons that are already visible on the page.
// ====================================================================

(function() {
    'use strict';

    // ----------------------------------------------------------------
    // FUNCTION: waitForElement
    // PURPOSE: Waits for a button/element to appear on the page before trying to use it
    // WHY: When the page first loads, buttons might not be ready yet, so we wait
    // PARAMETERS:
    //   - selector: The name/ID of the button we're looking for (like ".like-button")
    //   - callback: What to do once we find it
    // SAFETY: Only looks at the current page, doesn't access anything private
    // ----------------------------------------------------------------
    function waitForElement(selector, callback) {
        const element = document.querySelector(selector); // Look for the button on the page
        if (element) {
            callback(element); // Found it! Now do something with it
        } else {
            // Button not ready yet, check again in 0.5 seconds
            setTimeout(() => waitForElement(selector, callback), 500);
        }
    }

    // ----------------------------------------------------------------
    // MAIN SCRIPT START
    // Wait for the like button to appear on the page, then start clicking it
    // ----------------------------------------------------------------
    waitForElement('.like-button', function() {
        console.log('DLive Auto Like: Like button found, starting auto-clicker...');

        // ----------------------------------------------------------------
        // CONFIGURATION VARIABLES - These control how the script behaves
        // ----------------------------------------------------------------
        let clickCount = 0;                  // Tracks how many times we've clicked (resets after pause)
        const maxClicks = 190;               // After 190 clicks, pause for 5 seconds (to avoid looking like a bot)
        const pauseDuration = 5000;          // How long to pause (5000 milliseconds = 5 seconds)
        const minDelay = 100;                // Fastest time between clicks (100ms = 0.1 seconds)
        const maxDelay = 700;                // Slowest time between clicks (700ms = 0.7 seconds)
        const targetCount = 6000;            // STOP PERMANENTLY when stats reach this number (6k)
        let hasReachedTarget = false;        // Flag to track if we've hit our goal

        // ----------------------------------------------------------------
        // FUNCTION: getRandomDelay
        // PURPOSE: Picks a random time between 0.1 and 0.7 seconds
        // WHY: Makes the clicking look more human and less like a robot
        // SAFETY: Just does math, no data access
        // ----------------------------------------------------------------
        function getRandomDelay() {
            // Math.random() gives us a random number
            // We multiply it to get something between minDelay (100) and maxDelay (700)
            return Math.floor(Math.random() * (maxDelay - minDelay + 1)) + minDelay;
        }

        // ----------------------------------------------------------------
        // FUNCTION: getStatsCount
        // PURPOSE: Reads the stats number displayed on the DLive page
        // WHAT IT READS: The second stats item (the like count), for example "5.57K"
        // WHY: We need to know when we've reached 6000 likes so we can stop
        // SAFETY: Only reads text that's already visible on the page
        //         Does NOT access passwords, forms, or personal data
        // ----------------------------------------------------------------
        function getStatsCount() {
            // Look for the stats element on the page (the one that shows like count)
            // This is just reading what's already visible to you on screen
            const statsElement = document.querySelector('div.stats-item:nth-child(2) > span:nth-child(2).stats-count');

            if (statsElement) {
                const text = statsElement.textContent.trim(); // Get the text (like "5.57K")

                // Convert "5.57K" to actual number 5570, or "6000" to 6000
                if (text.includes('K')) {
                    // If it says "5.57K", remove the K and multiply by 1000
                    return parseFloat(text.replace('K', '')) * 1000;
                } else {
                    // If it's already a number like "6000", just convert it
                    return parseInt(text);
                }
            }
            return 0; // If we can't find the element, return 0
        }

        // ----------------------------------------------------------------
        // FUNCTION: clickWithJitter
        // PURPOSE: This is the main clicking function that runs over and over
        // WHAT IT DOES:
        //   1. Checks if we've reached 6000 likes (if yes, STOP FOREVER)
        //   2. Clicks any "Close" popup buttons that appear
        //   3. Clicks the like button
        //   4. Waits a random time before clicking again
        //   5. After 190 clicks, pauses for 5 seconds
        // SAFETY: Only clicks buttons that are visible on the page
        //         Does NOT access any forms, passwords, or personal data
        // ----------------------------------------------------------------
        function clickWithJitter() {
            // ----------------
            // STEP 1: Check if we've reached our goal (6000 likes)
            // ----------------
            const currentCount = getStatsCount(); // Read the stats number from the page

            // If we hit 6000 or more, STOP EVERYTHING
            if (currentCount >= targetCount && !hasReachedTarget) {
                hasReachedTarget = true; // Set flag so we don't keep checking
                console.log('DLive Auto Like: Target reached! Current count: ' + currentCount + '. Stopping clicks permanently.');
                return; // Exit the function - no more clicking!
            }

            // If we already stopped, don't do anything
            if (hasReachedTarget) {
                console.log('DLive Auto Like: Already reached target. Not clicking anymore.');
                return;
            }

            // ----------------
            // STEP 2: Click "Close" buttons if any popup appears
            // ----------------
            // Sometimes DLive shows popups with a "Close" button
            // This finds all buttons and clicks any that say "Close"
            const closeButtons = Array.from(document.querySelectorAll('.v-btn__content'));
            const closeButton = closeButtons.find(btn => btn.textContent.trim() === 'Close');
            if (closeButton) {
                closeButton.click(); // Click the Close button
                console.log('DLive Auto Like: Clicked Close button');
            }

            // ----------------
            // STEP 3: Click the like button
            // ----------------
            const likeButton = document.querySelector('.like-button'); // Find the like button

            if (likeButton) {
                likeButton.click(); // CLICK IT!
                clickCount++; // Increase our counter
                const delay = getRandomDelay(); // Pick a random wait time

                // Log to console so you can see what's happening
                console.log('DLive Auto Like: Clicked at ' + new Date().toLocaleTimeString() + ' (Count: ' + clickCount + ', Stats: ' + currentCount + ', Next in: ' + delay + 'ms)');

                // ----------------
                // STEP 4: Check if we need to take a 5-second break
                // ----------------
                // After 190 clicks, pause for 5 seconds to avoid detection
                if (clickCount >= maxClicks) {
                    console.log('DLive Auto Like: Reached ' + maxClicks + ' clicks. Pausing for ' + (pauseDuration / 1000) + ' seconds...');

                    // Wait 5 seconds, then reset counter and continue
                    setTimeout(function() {
                        clickCount = 0; // Reset the counter
                        console.log('DLive Auto Like: Resuming clicks...');
                        clickWithJitter(); // Start clicking again
                    }, pauseDuration);
                } else {
                    // Not at 190 yet, so just wait a random time and click again
                    setTimeout(clickWithJitter, delay);
                }
            } else {
                // Button disappeared? Wait 1 second and try again
                console.log('DLive Auto Like: Button not found, retrying...');
                setTimeout(clickWithJitter, 1000);
            }
        }

        // ----------------------------------------------------------------
        // START THE SCRIPT
        // This line kicks off the clicking cycle
        // Everything above was just defining what to do
        // This line actually starts doing it
        // ----------------------------------------------------------------
        clickWithJitter();
    });
})();

// ====================================================================
// END OF SCRIPT
//
// SUMMARY OF WHAT THIS SCRIPT DOES:
// 1. Waits for the DLive page to load
// 2. Finds the like button
// 3. Clicks it repeatedly with random delays (0.1-0.7 seconds)
// 4. After every 190 clicks, pauses for 5 seconds
// 5. Reads the like count from the page
// 6. When the count reaches 6000, stops permanently
// 7. Clicks "Close" on any popups that appear
//
// ====================================================================

