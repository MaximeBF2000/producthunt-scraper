const fs = require('node:fs')
const crypto = require('node:crypto')
const readline = require('node:readline')
const { promisify } = require('node:util')
const puppeteer = require('puppeteer')
const csv = require('csv-writer').createObjectCsvWriter

const sleep = seconds =>
  new Promise(resolve => setTimeout(resolve, seconds * 1000))

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
})
const ask = promisify(rl.question).bind(rl)

async function main() {
  const year = await ask('For what year do you want to scrape ? ')
  const scrollIterations = await ask(
    'How many scroll iterations do you want to make ? '
  )
  const fileName = await ask('What do you want to name the file ? ')

  const browser = await puppeteer.launch({
    headless: false,
    defaultViewport: null,
    args: ['--start-maximized']
  })
  const page = (await browser.pages())[0]
  await page.goto(
    `https://www.producthunt.com/leaderboard/yearly/${
      year || new Date().getFullYear()
    }`
  )
  await sleep(3)

  let scrollAmount = 0

  for (let i = 0; i < (scrollIterations || 100); i++) {
    await page.evaluate(
      currentScrollAmount => window.scrollTo(0, currentScrollAmount + 10_000),
      scrollAmount
    )
    scrollAmount += 10_000
    await sleep(1)
  }
  const elements = await page.$$('[data-test^="post-item-"]')

  let data = []

  for (const el of elements) {
    const res = await el.evaluate(element => {
      console.log('element', { element, html: element.innerHTML })
      const [productHuntLink, _, productHuntWebsiteLink] = [
        ...element.querySelectorAll('a')
      ].map(a => a.href)

      const productName = element.querySelector('strong').innerText
      const productHeadline = element
        .querySelectorAll('a')[1]
        .textContent.split(' — ')[1]
      const upvotes = parseInt(
        element.querySelector('button').textContent.replaceAll(',', '')
      )

      return {
        productHuntLink,
        productHuntWebsiteLink,
        productName,
        productHeadline,
        upvotes
      }
    })
    data.push(res)
  }

  await browser.close()

  const uid = crypto.randomUUID()

  fs.writeFileSync(`${fileName || uid}.json`, JSON.stringify(data, null, 2))

  const csvWriter = csv({
    path: `${fileName || uid}.csv`,
    header: [
      { id: 'productHuntLink', title: 'Product Hunt Link' },
      { id: 'productHuntWebsiteLink', title: 'Product Hunt Website Link' },
      { id: 'productName', title: 'Product Name' },
      { id: 'productHeadline', title: 'Product Headline' },
      { id: 'upvotes', title: 'Upvotes' }
    ]
  })
  await csvWriter.writeRecords(data)

  console.log('ProductHunt data has been saved ✅')
  process.exit(0)
}

main()
