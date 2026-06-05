Parameters
TIP

Parameters here are actually URI query and can be linked together with & to generate a complex feed.

Parameters here need to be placed after the route path. Some routes may have custom route parameters and parameters here need to be placed after them.

E.g., https://rsshub.app/twitter/user/durov/readable=1&includeRts=0?brief=100&limit=5

Filtering
WARNING

Please make sure you've fully URL-encoded the parameters. Do not rely on the browser's automatic URL encoding. Some characters, such as +, &, will not be automatically encoded, resulting in the final parsing result not being correct.

WARNING

filter supports Regex, and due to the fact that some Regex are vulnerable to DoS (ReDoS), default engine re2 blocks some of these functionalities available in node Regexp. These two engines also behaves a bit different in some corner cases. Details

If you need to use a different engine, please refer to Deploy->Features->FILTER_REGEX_ENGINE.

The following URL query parameters are supported, Regex support is built-in.

Set filter to include the content

filter: filter title and description

filter_title: filter title only

filter_description: filter description only

filter_author: filter author only

filter_category: filter category only

filter_time: filter pubDate, in seconds, return specified time range. Item without pubDate will not be filtered.

E.g. https://rsshub.app/dribbble/popular?filter=Blue|Yellow|Black

Set filterout to exclude unwanted content.

filterout: filter title and description

filterout_title: filter title only

filterout_description: filter description only

filterout_author: filter author only

filterout_category: filter category only

E.g. https://rsshub.app/dribbble/popular?filterout=Blue|Yellow|Black

Set filter_case_sensitive to determine whether the filtering keywords should be case sensitive. The parameter would apply to both filter and filterout.

Default: true

E.g. https://rsshub.app/dribbble/popular?filter=BluE|yeLLow|BlaCK&filter_case_sensitive=false

Limit Entries
Set limit to limit the number of articles in the feed.

E.g. Dribbble Popular Top 10 https://rsshub.app/dribbble/popular?limit=10

Sorted
Set sorted to control whether to sort the output by the publish date (pubDate). This is useful for some feeds that pin some entries at the top. Default to true i.e. the output is sorted.

E.g. NJU Undergraduate Bulletin Board https://rsshub.app/nju/jw/ggtz?sorted=false

Fulltext
Enable fulltext via mode parameter.

E.g. Bilibili article https://rsshub.app/bilibili/user/article/334958638?mode=fulltext

Access Control
Set key or code to grant access to requests. See Access Control Configuration.

Telegram Instant View
Replace website link with Telegram's Instant View link.

Enable Telegram Instant View requires a page template, it can be obtained from Telegram's Instant View page

tgiv: template hash, obtained from the link of template page generated（the string after &rhash=）
E.g. https://rsshub.app/novel/biquge/94_94525?tgiv=bd3c42818a7f7e

Sci-Hub link
Output Sci-Hub link in scientific journal routes, this supports major journals or routes that output DOIs.

scihub: set to any value
E.g. https://rsshub.app/pnas/latest?scihub=1

Conversion between Traditional and Simplified Chinese
opencc: s2t (Simplified Chinese to Traditional Chinese)、t2s (Traditional Chinese to Simplified Chinese), other optional values refer to simplecc-wasm - Configurations
E.g. https://rsshub.app/theinitium/channel/latest/zh-hans?opencc=t2s

Multimedia processing
WARNING

This is an experimental API

image_hotlink_template and multimedia_hotlink_template allow users to supply templates to replace media URLs. Certain routes plus certain RSS readers may result in users needing these features, but it's not very common. Vulnerable characters will be escaped automatically, making XSS attack impossible. The scope of URL replacement is limited to media elements, making any script URL unable to load and unable to cause XSS. As a result, users can only take the control of "where are the media from". These features are commonly side-effect-free. To enable these two parameters, please set ALLOW_USER_HOTLINK_TEMPLATE to true

image_hotlink_template: replace image URL in the description to avoid anti-hotlink protection, leave it blank to disable this function. Usage reference #2769. You may use any property listed in URL (suffixing with _ue results in URL encoding), format of JS template literal. e.g. ${protocol}//${host}${pathname}, https://i3.wp.com/${host}${pathname}, https://images.weserv.nl?url=${href_ue}
multimedia_hotlink_template: the same as image_hotlink_template but apply to audio and video. Note: the service must follow redirects, allow reverse-proxy for audio and video, and must drop the Referer header when reverse-proxying. Here is an easy-to-deploy project that fits these requirements. The project accepts simple URL concatenation, e.g. https://example.com/${href}, in which example.com should be replaced with the domain name of the service you've deployed
wrap_multimedia_in_iframe: wrap audio and video in <iframe> to prevent the reader from sending Referer header. This workaround is only compatible with a few readers, such as RSS Guard and Akregator, which may not support the previous method. You can try this method in such a case
There are more details in the FAQ.

Output Formats
RSSHub conforms to RSS 2.0, Atom, JSON Feed, and RSS3 Protocol. To obtain the feed in a specific format, simply add the format parameter with the value rss, atom, json, or rss3 to the feed address to obtain the feed in the corresponding format. The default output format is RSS 2.0.

E.g.

Default (RSS 2.0) - https://rsshub.app/dribbble/popular
RSS 2.0 - https://rsshub.app/dribbble/popular?format=rss
Atom - https://rsshub.app/dribbble/popular?format=atom
JSON Feed - https://rsshub.app/twitter/user/DIYgod?format=json
RSS3 - https://rsshub.app/abc?format=rss3
Apply filters or URL query - https://rsshub.app/dribbble/popular?format=atom&filterout=Blue|Yellow|Black
debug.json
If the RSSHub instance is running with debugInfo=true enabled, a route with debug.json format parameter will result in the value of ctx.set('json', obj) being returned.

This feature aims to facilitate debugging or developing customized features. A route developer has the freedom to determine whether to adopt it or not, without any format requirement.

For example：

/furstar/characters/cn?format=debug.json
debug.html
By adding {index}.debug.html (where {index} is a number starting from 0) format parameter and running the instance with debugInfo=true, RSSHub will return the content set in the plugin's data.item[index].description. You can access this page with a browser to quickly view the extracted information.

Example:

/furstar/characters/cn?format=0.debug.html
Brief introduction
Set the parameter brief to generate a brief pure-text introduction with a limited number of characters ( ≥ 100).

For example：

Brief introduction with 100 characters: ?brief=100

------------

Instagram
Instagram
www.instagram.com
374.6K
🌟 Popular
💬 Social Media

User Profile - Picnob

🔥 374552🟢 Passed Test

👨‍💻 Author:
TonyRL

💡 Example: https://rsshub.app/picnob.info/user/xlisa_olivex

🔥 Top Feeds on Folo:
ciu7 (@ciu7777) public posts - Picnob
Lin lin (@peppapig6077) public posts - Picnob
🛎️ Route:
/picnob.info/user/:id/:type?

🔗 Parameters:

id
Required
Description:Instagram id
type
Optional
Default: posts
Options:
posts: Posts
Description:Type of profile page
🐙 Source Code: /picnob.info/user.ts

---
Instagram
Instagram
www.instagram.com
🌟 Popular
💬 Social Media

Routes
User Profile - Pixnoy

🔥 45753🔍 Support Radar

👨‍💻 Author:
TonyRL
micheal-death
AiraNadih
DIYgod
hyoban
Rongronggg9

💡 Example: https://rsshub.app/picnob/user/xlisa_olivex

🔥 Top Feeds on Folo:
瓦基｜閱讀前哨站｜下一本讀什麼 (@readingoutpost/) public posts - Picnob
NBA (@nba) public posts - Picnob
🛎️ Route:
/picnob/user/:id/:type?

🔗 Parameters:

id
Required
Description:Instagram id
type
Optional
Description:Type of profile page (profile or tagged)
🐙 Source Code: /picnob/user.ts

-------
User Profile - Picuki

🔥 10766🚨 Strict Anti-crawling🎭 Rely on Puppeteer🔍 Support Radar

👨‍💻 Author:
hoilc
Rongronggg9
devinmugen
NekoAria

💡 Example: https://rsshub.app/picuki/profile/linustech

🔥 Top Feeds on Folo:
@soyeemilk__ 豆乳 view and download public TikTok videos and stories - Tikvib.com
白银 (@baiyinn811) public posts - Picuki
🛎️ Route:
/picuki/profile/:id/:type?/:functionalFlag?

🔗 Parameters:

id
Required
Description:Tiktok user id (without @)
type
Optional
Default: profile
Options:
profile: Profile Page
Description:Type of profile page
functionalFlag
Optional
Default: 1
Options:
0: Off, only show video poster as an image
Description:Functional flag for video embedding
🐙 Source Code: /picuki/profile.ts

-------
Routes
Transformation - HTML

🔥 7664⚙️ Config Required

👨‍💻 Author:
ttttmr
hyoban

💡 Example: https://rsshub.app/rsshub/transform/html/https%3A%2F%2Fwechat2rss.xlab.app%2Fposts%2Flist%2F/item=div%5Bclass%3D%27post%2Dcontent%27%5D%20p%20a

🔥 Top Feeds on Folo:
我不是矿神 - 群晖,威联通,铁威马,绿联UGOS,万由UNAS,飞牛fnOS,UNRAID,ESXI,PVE,OPENWRT
javDB无码
🛎️ Route:
/rsshub/transform/html/:url/:routeParams

🔗 Parameters:

url
Required
Description:encodeURIComponented URL address
routeParams
Required
Description:Transformation rules, requires URL encode
⚙️ Deployment Configs:

ALLOW_USER_SUPPLY_UNSAFE_DOMAIN, required -
🐙 Source Code: /rsshub/transform/html.ts

Pass URL and transformation rules to convert HTML/JSON into RSS.

Specify options (in the format of query string) in parameter routeParams parameter to extract data from HTML.

Key Meaning Accepted Values Default
title The title of the RSS string Extract from <title>
item The HTML elements as item using CSS selector string html
itemTitle The HTML elements as title in item using CSS selector string item element
itemTitleAttr The attributes of title element as title string Element text
itemLink The HTML elements as link in item using CSS selector string item element
itemLinkAttr The attributes of link element as link string href
itemDesc The HTML elements as descrption in item using CSS selector string item element
itemDescAttr The attributes of descrption element as description string Element html
itemPubDate The HTML elements as pubDate in item using CSS selector string item element
itemPubDateAttr The attributes of pubDate element as pubDate string Element html
itemContent The HTML elements as description in item using CSS selector ( in itemLink page for full content ) string 
encoding The encoding of the HTML content string utf-8
Parameters parsing in the above example:

Parameter Value
url https://wechat2rss.xlab.app/posts/list/
routeParams item=div[class='post-content'] p a
Parsing of routeParams parameter:

Parameter Value
item div[class='post-content'] p a
New routes

🔥 4521🟢 Passed Test🔍 Support Radar

👨‍💻 Author:
DIYgod

💡 Example: https://rsshub.app/rsshub/routes/en

🔥 Top Feeds on Folo:
RSSHub has new routes
RSSHub 有新路由啦
🛎️ Route:
/rsshub/routes/:lang?

🔗 Parameters:

lang
Optional
Default: en
Options:
zh: Chinese
Description:Language
🐙 Source Code: /rsshub/routes.ts

Transformation - JSON

🔥 12⚙️ Config Required

👨‍💻 Author:
ttttmr

💡 Example: https://rsshub.app/rsshub/transform/json/https%3A%2F%2Fapi.github.com%2Frepos%2Fginuerzh%2Fgost%2Freleases/title=Gost%20releases&itemTitle=tag_name&itemLink=html_url&itemDesc=body

🔥 Top Feeds on Folo:
suo5 releases
IOM releases
🛎️ Route:
/rsshub/transform/json/:url/:routeParams

🔗 Parameters:

url
Required
Description:encodeURIComponented URL address
routeParams
Required
Description:Transformation rules, requires URL encode
⚙️ Deployment Configs:

ALLOW_USER_SUPPLY_UNSAFE_DOMAIN, required -
🐙 Source Code: /rsshub/transform/json.ts

Specify options (in the format of query string) in parameter routeParams parameter to extract data from JSON.

Key Meaning Accepted Values Default
title The title of the RSS string Extracted from home page of current domain
item The JSON Path as item element string Entire JSON response
itemTitle The JSON Path as title in item string None
itemLink The JSON Path as link in item string None
itemLinkPrefix Optional Prefix for itemLink value string None
itemDesc The JSON Path as description in item string None
itemPubDate The JSON Path as pubDate in item string None
::: tip JSON Path only supports format like a.b.c. if you need to access arrays, like a[0].b, you can write it as a.0.b. :::

Parameters parsing in the above example:

Parameter Value
url https://api.github.com/repos/ginuerzh/gost/releases
routeParams title=Gost releases&itemTitle=tag_name&itemLink=html_url&itemDesc=body
Parsing of routeParams parameter:

Parameter Value
title Gost releases
itemTitle tag_name
itemLink html_url
itemDesc body
Unknown

🟡 Missing Test

👨‍💻 Author:
flrngel

🛎️ Route:
/rsshub/transform/sitemap/:url/:routeParams?

🔗 Parameters:

url
Required
Description:N/A
routeParams
Optional
Description:N/A
🐙 Source Code: /rsshub/transform/sitemap.ts
-----------------------
YouTube
YouTube
youtube.com
300.2K
🌟 Popular
💬 Social Media
🎥 Live
Routes
Channel with user handle

🔥 295104⚙️ Config Required🔍 Support Radar

👨‍💻 Author:
DIYgod
pseudoyu

💡 Example: https://rsshub.app/youtube/user/@JFlaMusic

🔥 Top Feeds on Folo:
Andrej Karpathy - YouTube
Anthropic - YouTube
🛎️ Route:
/youtube/user/:username/:routeParams?

🔗 Parameters:

username
Required
Description:YouTuber handle with @
routeParams
Optional
Description:Extra parameters, see the table below
⚙️ Deployment Configs:

YOUTUBE_KEY, optional - YouTube API Key, support multiple keys, split them with ,, API Key application
🐙 Source Code: /youtube/user.ts

::: tip Parameter

Name Description Default
embed Whether to embed the video, fill in any value to disable embedding embed
filterShorts Whether to filter out shorts from the feed, fill in any falsy value to show shorts true
:::  
Channel with id

🔥 3102⚙️ Config Required🔍 Support Radar

👨‍💻 Author:
DIYgod
pseudoyu

💡 Example: https://rsshub.app/youtube/channel/UCDwDMPOZfxVV0x_dz0eQ8KQ

🔥 Top Feeds on Folo:
Coding with Lewis - YouTube
小钟Johnny - YouTube
🛎️ Route:
/youtube/channel/:id/:routeParams?

🔗 Parameters:

id
Required
Description:YouTube channel id
routeParams
Optional
Description:Extra parameters, see the table below
⚙️ Deployment Configs:

YOUTUBE_KEY, optional - YouTube API Key, support multiple keys, split them with ,, API Key application
🐙 Source Code: /youtube/channel.ts

::: tip Parameter

Name Description Default
embed Whether to embed the video, fill in any value to disable embedding embed
filterShorts Whether to filter out shorts from the feed, fill in any falsy value to show shorts true
:::  
::: tip YouTube provides official RSS feeds for channels, for instance https://www.youtube.com/feeds/videos.xml?channel_id=UCDwDMPOZfxVV0x_dz0eQ8KQ. :::

Playlist

🔥 1569🟢 Passed Test⚙️ Config Required

👨‍💻 Author:
HenryQW

💡 Example: https://rsshub.app/youtube/playlist/PLqQ1RwlxOgeLTJ1f3fNMSwhjVgaWKo_9Z

🔥 Top Feeds on Folo:
王局拍案 by 王志安 - YouTube
付鹏说 by Since1982 - YouTube
🛎️ Route:
/youtube/playlist/:id/:embed?

🔗 Parameters:

id
Required
Description:YouTube playlist id
embed
Optional
Description:Default to embed the video, set to any value to disable embedding
⚙️ Deployment Configs:

YOUTUBE_KEY, optional - YouTube API Key, support multiple keys, split them with ,, API Key application
🐙 Source Code: /youtube/playlist.ts

Community Posts

🔥 163🟢 Passed Test

👨‍💻 Author:
TonyRL

💡 Example: https://rsshub.app/youtube/community/@JFlaMusic

🔥 Top Feeds on Folo:
柴静 Chai Jing - Community Posts- YouTube
小叔TV - Community Posts- YouTube
🛎️ Route:
/youtube/community/:handle

🔗 Parameters:

handle
Required
Description:YouTube handles or channel id
🐙 Source Code: /youtube/community.tsx

Live

🔥 148🟡 Missing Test⚙️ Config Required

👨‍💻 Author:
sussurr127

💡 Example: https://rsshub.app/youtube/live/@GawrGura

🔥 Top Feeds on Folo:
老高與小茉 Mr & Mrs Gao's Live Status
Gawr Gura Ch. hololive-EN's Live Status
🛎️ Route:
/youtube/live/:username/:embed?

🔗 Parameters:

username
Required
Description:YouTuber id
embed
Optional
Description:Default to embed the video, set to any value to disable embedding
⚙️ Deployment Configs:

YOUTUBE_KEY, required - YouTube API Key (enable YouTube Data API v3), support multiple keys, split them with ,, API Key application, YouTube Data API v3
🐙 Source Code: /youtube/live.ts

Custom URL

🔥 89🟡 Missing Test⚙️ Config Required🔍 Support Radar

👨‍💻 Author:
TonyRL

💡 Example: https://rsshub.app/youtube/c/YouTubeCreators

🔥 Top Feeds on Folo:
3blue1brown - YouTube
lexfridman - YouTube
🛎️ Route:
/youtube/c/:username/:embed?

🔗 Parameters:

username
Required
Description:YouTube custom URL
embed
Optional
Description:Default to embed the video, set to any value to disable embedding
⚙️ Deployment Configs:

YOUTUBE_KEY, required - YouTube API Key, support multiple keys, split them with ,, API Key application
🐙 Source Code: /youtube/custom.ts

Music Charts

🔥 36🟢 Passed Test

👨‍💻 Author:
TonyRL

💡 Example: https://rsshub.app/youtube/charts

🔥 Top Feeds on Folo:
YouTube Music Charts - Top music videos
YouTube Music Charts - Top songs
🛎️ Route:
/youtube/charts/:category?/:country?/:embed?

🔗 Parameters:

category
Optional
Description:Chart, see table below, default to TopVideos
country
Optional
Description:Country Code, see table below, default to global
embed
Optional
Description:Default to embed the video, set to any value to disable embedding
🐙 Source Code: /youtube/charts.ts

Chart

Top artists Top songs Top music videos Trending
TopArtists TopSongs TopVideos TrendingVideos
Country Code

Argentina Australia Austria Belgium Bolivia Brazil Canada
ar au at be bo br ca
Chile Colombia Costa Rica Czechia Denmark Dominican Republic Ecuador
cl co cr cz dk do ec
Egypt El Salvador Estonia Finland France Germany Guatemala
eg sv ee fi fr de gt
Honduras Hungary Iceland India Indonesia Ireland Israel Italy
hn hu is in id ie il it
Japan Kenya Luxembourg Mexico Netherlands New Zealand Nicaragua
jp ke lu mx nl nz ni
Nigeria Norway Panama Paraguay Peru Poland Portugal Romania
ng no pa py pe pl pt ro
Russia Saudi Arabia Serbia South Africa South Korea Spain Sweden Switzerland
ru sa rs za kr es se ch
Tanzania Turkey Uganda Ukraine United Arab Emirates United Kingdom United States
tz tr ug ua ae gb us
Uruguay Zimbabwe
uy zw
Subscriptions

🔥 16🟡 Missing Test⚙️ Config Required🔍 Support Radar

👨‍💻 Author:
TonyRL

💡 Example: https://rsshub.app/youtube/subscriptions

🔥 Top Feeds on Folo:
Subscriptions - YouTube
🛎️ Route:
/youtube/subscriptions/:embed?

🔗 Parameters:

embed
Optional
Description:Default to embed the video, set to any value to disable embedding
⚙️ Deployment Configs:

YOUTUBE_KEY, required -
YOUTUBE_CLIENT_ID, required -
YOUTUBE_CLIENT_SECRET, required -
YOUTUBE_REFRESH_TOKEN, required -
🐙 Source Code: /youtube/subscriptions.ts
