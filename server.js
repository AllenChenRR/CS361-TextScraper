const express = require('express');
const axios = require('axios');
const cheerio = require('cheerio');
const fs = require('fs');
const { data } = require('cheerio/lib/api/attributes');
const { remove } = require('cheerio/lib/api/manipulation');
app = express();

app.enable('trust proxy');
app.use(express.json());

// app.use('/', require('./index'));

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

function getWikiData (html) {
  const data = [];
  const $ = cheerio.load(html);
  // Gets the introductory text
  var tempIntro = $(".mw-parser-output p").first();
  console.log(typeof tempIntro.text())
  var introContent = ""
  while ($(tempIntro).prop("tagName") == "P") {
    introContent += $(tempIntro).text()
    tempIntro = $(tempIntro).next();
  }

  data.push(
    {
      header: "Intro",
      content:  removeExtraChars(introContent)
    }
  )

  $(".mw-parser-output h2").each((i, elem) => {
    var group = {}
    group.header = $(elem).text();
    group.content = "";
    var tempElem = $(elem).next();
    console.log(`${group.header} ${$(tempElem)} group ${JSON.stringify(group)}`)
    // Loops through all <p> elements following the header until another header is reached
    // if ($(tempElem).length !== 0) {
    //   while ($(tempElem).prop("tagName") != "H2") {
    //     if ($(tempElem).prop("tagName") == "P") {
    //       group.content += $(tempElem).text();
    //     }
    //     tempElem = $(tempElem).next()
    //   }

    if ($(tempElem).length !== 0) {
      while ($(tempElem).prop("tagName") == "P") {
        group.content += $(tempElem).text();
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
  console.log(scrapedResult)
  return scrapedResult;
}

app.get('/', (req, res) => {
  res.status(200).send("CS361 Text Scraper by Allen Chen")
})

app.get('/data', (req, res) => {
  const url = req.query.url;
  console.log(typeof url)
  axios.get(url)
    .then(response => {
      // fs.writeFile('responseData.html', response.data, (err) => {
      //   if (err) throw err;
      // });
      // let getData = html => {
      //   data = [];
      //   const $ = cheerio.load(html);
      //   console.log($)
      // }
      return res.status(200).json(getWikiData(response.data));
      // const $ = cheerio.load(response.data);
      // console.log($.html())
    })
    .catch(error => {
      console.log(error);
    })
  // res.status(200).send('It works').end();
})


// Listen to the App Engine-specified port, or 8080 otherwise
const PORT = process.env.PORT || 8080;

app.listen(PORT, () => {
    console.log(`Server listening on port ${PORT}...`);
  });