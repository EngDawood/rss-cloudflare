/**
 * Test script for Unofficial Google Translate API (client=gtx)
 * Run with: node scripts/test-translate.js
 */

async function translateUnofficial(text, targetLang = 'en') {
    if (!text || text.trim().length === 0) {
        return '';
    }

    console.log(`\nTranslating text to [${targetLang}] (Length: ${text.length} chars)...`);

    // Split text into chunks of 1000 characters to avoid 414 URI Too Long errors
    const maxChunkSize = 1000;
    const regex = new RegExp(`.{1,${maxChunkSize}}`, 'g');
    const chunks = text.match(regex) || [text];

    const translatedChunks = [];

    for (let i = 0; i < chunks.length; i++) {
        const chunk = chunks[i];
        if (chunks.length > 1) {
            console.log(`  Processing chunk ${i + 1}/${chunks.length}...`);
        }

        const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=${targetLang}&dt=t&q=${encodeURIComponent(chunk)}`;

        const response = await fetch(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            }
        });

        if (!response.ok) {
            throw new Error(`Google Translate returned status ${response.status}: ${response.statusText}`);
        }

        const json = await response.json();
        
        // Unofficial response is a deeply nested array:
        // json[0] is an array of segments.
        // Each segment is [translatedText, originalText, ...]
        if (json && json[0]) {
            const translatedSegment = json[0].map(segment => segment[0]).join('');
            translatedChunks.push(translatedSegment);
        } else {
            throw new Error('Unexpected Google Translate response format');
        }
    }

    return translatedChunks.join(' ');
}

async function runTests() {
    try {
        console.log('--- Starting Unofficial Google Translate Tests ---');

        // Test 1: Short English to Arabic
        const text1 = "Hello world! This is a simple test of the unofficial Google Translate API. I hope it works well.";
        const translation1 = await translateUnofficial(text1, 'ar');
        console.log('Original Text (EN):', text1);
        console.log('Translated Text (AR):', translation1);

        console.log('\n--------------------------------------------------');

        // Test 2: Short Arabic to English
        const text2 = "مرحباً بكم في هذا الاختبار. نحن نتحقق من مدى كفاءة الترجمة التلقائية بدون مفاتيح برمجية.";
        const translation2 = await translateUnofficial(text2, 'en');
        console.log('Original Text (AR):', text2);
        console.log('Translated Text (EN):', translation2);

        console.log('\n--------------------------------------------------');

        // Test 3: Long text that triggers chunking (1500+ chars)
        const text3 = `The Cloudflare Worker serves as the centralized backend for our RSS bridge. ` +
            `It handles Hono routing, queue dispatching, and cron tasks. Every five minutes, a cron trigger ` +
            `activates to fetch configured social media accounts via various RSS-Bridge and RSSHub instances. ` +
            `It then performs media enrichment to find the highest resolution video or photo enclosures. ` +
            `If the content is too long to send as a normal message on Telegram, it is parsed and uploaded to Telegraph, ` +
            `which allows for full-length article reading without cluttering the chat history. ` +
            `Additionally, it supports AI Gateway integrations for automatic summarization in Arabic. ` +
            `To make this system reliable, we have implemented a double-fault protection pattern. ` +
            `If the bot encounters a rate limit (HTTP 429) or transient error, the queue consumer will automatically ` +
            `retry with exponential backoff. This ensures that no posts are lost and rate limits are respected. ` +
            `Furthermore, initial setup of any subscription will seed all existing feed items into the KV store ` +
            `so that subsequent cron runs only process the brand new posts, preventing channel flooding. ` +
            `All of these components work seamlessly together to provide a robust feed processing engine. ` +
            `By adding translation support, we will allow users to read feeds in their native language directly. ` +
            `This test script simulates chunking for this long description. ` +
            `We will translate this text to French to verify multilingual capabilities.`;

        const translation3 = await translateUnofficial(text3, 'fr');
        console.log('Original Text (EN) Length:', text3.length);
        console.log('Translated Text (FR):', translation3);

        console.log('\n--- All Tests Passed Successfully! ---');
    } catch (error) {
        console.error('\n❌ Test failed with error:', error.message);
    }
}

runTests();
