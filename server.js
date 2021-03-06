const express = require('express');
const axios = require('axios');
const cheerio = require('cheerio');
const cors = require('cors')
const fs = require('fs');
const { data } = require('cheerio/lib/api/attributes');
const { remove } = require('cheerio/lib/api/manipulation');
const e = require('express');
app = express();

app.enable('trust proxy');
app.use(express.json());
app.use(cors())

// app.use('/', require('./index'));

const ignoredHeaders = ['Contents', 'References', 'External links', 'See also', 'Notes', 'Notes and references']
const WIKIBOOK_URL = 'https://en.wikibooks.org'

function sleep(milliseconds) {
  const date = Date.now();
  let currentDate = null;
  do {
    currentDate = Date.now();
  } while (currentDate - date < milliseconds);
}

function isDeadLink(url) {
  return url.includes("redlink");
}

function isRecipeLink(url) {
  return url.includes("/wiki/Cookbook:")
}

function checkValidHeaders(header, ignoredHeaders) {
  for (var i = 0; i < ignoredHeaders.length; i++) {
    if (header == ignoredHeaders[i]) {
      return true;
    }
  }
  return false;
}

function removeFootnotes (text) {
  var skip = false;
  var newText = [];
  for (var i = 0; i < text.length; i++) {
    if (skip && text.charAt(i) == ']') {
      skip = false; 
      continue;
    }
    if (text.charAt(i) == '[') {
      skip = true;
      continue;
    }
    if (skip) {
      continue;
    }
    newText.push(text.charAt(i));
  }
  return newText.join('');
}

function removeNewline(text) {
  return text.replace(/\n/g, "");
}

function removeExtraChars(text) {
  var noFootnotes = removeFootnotes(text);
  return removeNewline(noFootnotes)
}

function removeParentheses(text) {
  var newText = [];
  for (var i  = 0; i < text.length; i++) {
    if (text.charAt(i) != '(') {
      newText.push(text.charAt(i));
    } else {
      newText.pop();
      return newText.join('');
    }
  }
  return newText.join('');
}

function getCuisinesList (html) {
  const data = [];
  const $ = cheerio.load(html)

  var cuisineList = $(".mw-parser-output ul").first().children();
  cuisineList.each((i, elem) => {
    var cuisine = $(elem).text()
    var linkUrl = $(elem).find("a").attr("href");
    var entity = {
      cuisine: removeParentheses(cuisine),
      url: `${WIKIBOOK_URL}${linkUrl}`
    }
    data.push(entity);
  })
  return data;
}

function getCountriesList (html) {
  const data = [];
  const $ = cheerio.load(html);

  regionList = $(".mw-parser-output ul");
  regionList.each((i, region) => {

    var countryList = $(region).children();
    countryList.each((i, country) => {
      var countryText = $(country).text();
      var countryUrl = $(country).find("a").attr("href")
      if (!isDeadLink(countryUrl)) {
        var entity = {
          cuisine: removeParentheses(countryText),
          url: `${WIKIBOOK_URL}${countryUrl}`
        }
        data.push(entity)
      }
    })
  })
  return data;
}

function getWikiData (html) {
  const data = [];
  const $ = cheerio.load(html);
  // Gets the introductory text
  var tempIntro = $(".mw-parser-output p").first();
  var introContent = ""
  while ($(tempIntro).prop("tagName") != "H2") {
    if ($(tempIntro).prop("tagName") == "P") {
      introContent += $(tempIntro).text()
    }
    tempIntro = $(tempIntro).next();
  }
  // Push the introductory text object into the data array
  data.push(
    {
      header: "Intro",
      content:  removeExtraChars(introContent)
    }
  )

  $(".mw-parser-output h2").each((i, elem) => {
    const header = removeFootnotes($(elem).text());
    // Skips grabbing text for invalid headers
    if (checkValidHeaders(header, ignoredHeaders)) {
      return;
    }
    var group = {}
    group.header = $(elem).text();
    group.content = "";
    var tempElem = $(elem).next();

    // Loops through all <p> elements following the header until another header is reached
    if ($(tempElem).length !== 0) {
      while ($(tempElem).prop("tagName") != "H2") {
        if ($(tempElem).prop("tagName") == "P") {
          group.content += $(tempElem).text();
        }
        tempElem = $(tempElem).next()
      }
      group.header = removeExtraChars(group.header);
      group.content = removeExtraChars(group.content);
      data.push(group)
    }
  })
  var scrapedResult = {
    data: data
  }
  return scrapedResult;
}

async function getDishesFromHtml(dishList, html) {
  const $ = cheerio.load(html);
  var dishItems = $(".mw-parser-output li")
  dishItems.each((i, element) => {
    if ($(element).has("a")) {
      var dishLink = $(element).find("a").attr("href");
      if (dishLink && !isDeadLink(dishLink) && isRecipeLink(dishLink)) {
        // console.log($(element).text())
        dishList.push({
          dish: removeParentheses($(element).text()),
          url: `${WIKIBOOK_URL}${dishLink}`
        })
      }
    }
  })
}

// Adds the list of dishes in the url to dish list
async function addDishes(dishList, url) {
  // dish list will contain a list of objects with name of the dish and the link
  var response = await axios.get(url);
  await getDishesFromHtml(dishList, response.data)
  // console.log(`add dishes`)
  // console.log(dishList)
}


async function getRecipeInfo(url) {
  const data = {
    ingredients: [],
    procedures: []
  };
  var response = await axios.get(url);
  const $ = cheerio.load(response.data);
  var ingredients = $(".mw-parser-output ul").first().children();
  var procedures = $(".mw-parser-output ol").first().children();

  ingredients.each((i, elem) => {
    data.ingredients.push($(elem).text())
  })

  procedures.each((i, elem) => {
    data.procedures.push($(elem).text())
  })

  return data
}

async function getRecipeList(url) {
  var data = []
  var response = await axios.get(url);
  const $ = cheerio.load(response.data)
  var recipes = $(".mw-parser-output li");
  recipes.each((i, elem) => {
    var recipeName = $(elem).text();
    var recipeUrl = $(elem).find("a").attr("href")
    data.push({
      recipe: removeParentheses(recipeName),
      url: `${WIKIBOOK_URL}${recipeUrl}`
    })
  })
  return data;
}


//<-----------------------------------Routes----------------------------------------->

app.get('/', (req, res) => {
  res.status(200).send("CS361 Text Scraper by Allen Chen")
})

app.get('/data', (req, res) => {
  const url = req.query.url;
  const newLine = req.query.newline;
  axios.get(url)
    .then(response => {
      return res.status(200).json(getWikiData(response.data));
    })
    .catch(error => {
      console.log(error);
      return res.status(404).json({Error: "Invalid URL"})
    })
  // res.status(200).send('It works').end();
})

app.get('/lists', async (req, res) => {
  const type = req.query.type
  const url = req.query.url;
  var response = await axios.get(url)
  // fs.writeFile('./listData.html', response.data, err => {
  //   if (err) {
  //     console.log(err);
  //     return
  //   }
  // })
  if (type == 'cuisines') {
    var responseData = getCuisinesList(response.data);
  }

  if (type == 'countries') {
    var responseData = [];
    var countries = getCountriesList(response.data);

    for (var i = 0; i < countries.length; i++) {
      var country = countries[i];
      await addDishes(responseData, country.url)
    } 
  }

  if (type == 'dish') {
    var responseData = await getRecipeInfo(url)
  }

  if (type == 'recipes') {
    var responseData = await getRecipeList(url)
  }

  res.status(200).json(responseData);
})


// Listen to the App Engine-specified port, or 8080 otherwise
const PORT = process.env.PORT || 8080;

app.listen(PORT, () => {
    console.log(`Server listening on port ${PORT}...`);
  });