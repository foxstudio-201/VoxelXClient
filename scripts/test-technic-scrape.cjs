const url = 'https://www.technicpack.net/modpack/the-1122-pack.1406454'
fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' } })
  .then(r => r.text())
  .then(html => {
    // Look for og:description meta tag
    const ogDesc = html.match(/<meta[^>]+property="og:description"[^>]+content="([^"]+)"/i)
    console.log('og:description:', ogDesc ? ogDesc[1] : 'not found')

    // Look for description meta
    const metaDesc = html.match(/<meta[^>]+name="description"[^>]+content="([^"]+)"/i)
    console.log('meta description:', metaDesc ? metaDesc[1] : 'not found')

    // Look for pack-description or similar class
    const packDesc = html.match(/class="[^"]*pack[^"]*description[^"]*"[^>]*>([\s\S]{0,500})/i)
    console.log('pack-description class:', packDesc ? packDesc[0].slice(0, 300) : 'not found')

    // Look for data-description
    const dataDesc = html.match(/data-description="([^"]{0,500})"/i)
    console.log('data-description:', dataDesc ? dataDesc[1] : 'not found')

    // Check if page is JS-rendered (Angular/React)
    console.log('\nPage size:', html.length)
    console.log('Has ng-app:', html.includes('ng-app'))
    console.log('Has angular:', html.toLowerCase().includes('angular'))
    console.log('First 500 chars of body:', html.slice(html.indexOf('<body'), html.indexOf('<body') + 500))
  })
