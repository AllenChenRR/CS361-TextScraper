const express = require('express');
const axios = require('axios');
const cheerio = require('cheerio');
const fs = require('fs');
const { data } = require('cheerio/lib/api/attributes');
app = express();

app.enable('trust proxy');
app.use(express.json());

// app.use('/', require('./index'));

function getWikiData (html) {
  const data = [];
  const $ = cheerio.load(html);
  // Gets the introductory text
  var tempIntro = $(".mw-parser-output p").first();
  console.log(typeof tempIntro.text())
  var introContent = ""
  while($(tempIntro).prop("tagName") == "P") {
    introContent += $(tempIntro).text()
    tempIntro = $(tempIntro).next();
  }
  data.push(
    {
      header: "Intro",
      content:  introContent
    }
  )

  $(".mw-parser-output h2").each((i, elem) => {
    var group = {}
    group.header = $(elem).text();
    group.content = "";
    var tempElem = $(elem).next();
    // Loops through all <p> elements following the header until another header is reached
    while ($(tempElem).prop("tagName") == "P") {
      group.content += $(tempElem).text();
      tempElem = $(tempElem).next()
    }

    data.push(group)
  })
  var scrapedResult = {
    data: data
  }
  console.log(scrapedResult)
  return scrapedResult;
}

app.get('/', (req, res) => {
  const url = req.body.url;
  axios.get(url)
    .then(response => {
      fs.writeFile('responseData.html', response.data, (err) => {
        if (err) throw err;
      });
      // let getData = html => {
      //   data = [];
      //   const $ = cheerio.load(html);
      //   console.log($)
      // }
      return res.status(200).send(getWikiData(response.data));
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