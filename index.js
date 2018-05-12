// Lambda Function code for Alexa.
// Paste this into your index.js file. 

const Alexa = require("ask-sdk");
const https = require("https");

const invocationName = "public holidays";

// Session Attributes 
//   Alexa will track attributes for you, by default only during the lifespan of your session.
//   The history[] array will track previous request(s), used for contextual Help/Yes/No handling.
//   Set up DynamoDB persistence to have the skill save and reload these attributes between skill sessions.

function getMemoryAttributes() {
  const memoryAttributes = {
    "history": [],

    // The remaining attributes will be useful after DynamoDB persistence is configured
    "launchCount": 0,
    "lastUseTimestamp": 0

    // "favoriteColor":"",
    // "name":"",
    // "namePronounce":"",
    // "email":"",
    // "mobileNumber":"",
    // "city":"",
    // "state":"",
    // "postcode":"",
    // "birthday":"",
    // "bookmark":0,
    // "wishlist":[],
  };
  return memoryAttributes;
};

const weatherAPI = {
  host: 'www.gov.uk',
  port: 443,
  path: `/bank-holidays.json`,
  method: 'GET',
};

function getUKPublicHolidays(callback) {
  const req = https.request(weatherAPI, (res) => {
    res.setEncoding('utf8');
    let returnData = '';

    res.on('data', (chunk) => {
      returnData += chunk;
    });
    res.on('end', () => {
      let retData = JSON.parse(returnData);
      callback(retData);
      // const channelObj = JSON.parse(returnData).query.results.channel;

      // let localTime = channelObj.lastBuildDate.toString();
      // localTime = localTime.substring(17, 25).trim();

      // const currentTemp = channelObj.item.condition.temp;

      // const currentCondition = channelObj.item.condition.text;

      // callback(localTime, currentTemp, currentCondition);
    });
  });
  req.end();
}

const maxHistorySize = 20; // remember only latest 20 intents 


// 1. Intent Handlers =============================================

const AMAZON_CancelIntent_Handler = {
  canHandle(handlerInput) {
    const request = handlerInput.requestEnvelope.request;
    return request.type === 'IntentRequest' && request.intent.name === 'AMAZON.CancelIntent';
  },
  handle(handlerInput) {
    const request = handlerInput.requestEnvelope.request;
    const responseBuilder = handlerInput.responseBuilder;
    let sessionAttributes = handlerInput.attributesManager.getSessionAttributes();


    let say = 'Okay, talk to you later! ';

    return responseBuilder
      .speak(say)
      .withShouldEndSession(true)
      .getResponse();
  },
};

const AMAZON_HelpIntent_Handler = {
  canHandle(handlerInput) {
    const request = handlerInput.requestEnvelope.request;
    return request.type === 'IntentRequest' && request.intent.name === 'AMAZON.HelpIntent';
  },
  handle(handlerInput) {
    const request = handlerInput.requestEnvelope.request;
    const responseBuilder = handlerInput.responseBuilder;
    let sessionAttributes = handlerInput.attributesManager.getSessionAttributes();

    let intents = getCustomIntents();
    let sampleIntent = randomElement(intents);

    let say = 'You asked for help. ';
    let previousIntent = getPreviousIntent(sessionAttributes);

    if (previousIntent && !handlerInput.requestEnvelope.session.new) {
      say += 'Your last intent was ' + previousIntent + '. ';
    }
    say += 'I understand  ' + intents.length + ' intents, here something you can ask me, ' + getSampleUtterance(sampleIntent);

    return responseBuilder
      .speak(say)
      .reprompt('try again, ' + say)
      .getResponse();
  },
};

const AMAZON_StopIntent_Handler = {
  canHandle(handlerInput) {
    const request = handlerInput.requestEnvelope.request;
    return request.type === 'IntentRequest' && request.intent.name === 'AMAZON.StopIntent';
  },
  handle(handlerInput) {
    const request = handlerInput.requestEnvelope.request;
    const responseBuilder = handlerInput.responseBuilder;
    let sessionAttributes = handlerInput.attributesManager.getSessionAttributes();


    let say = 'Okay, talk to you later! ';

    return responseBuilder
      .speak(say)
      .withShouldEndSession(true)
      .getResponse();
  },
};

const FindNextHolidayIntent_Handler = {
  canHandle(handlerInput) {
    const request = handlerInput.requestEnvelope.request;
    return request.type === 'IntentRequest' && request.intent.name === 'FindNextHolidayIntent';
  },
  handle(handlerInput) {
    const request = handlerInput.requestEnvelope.request;
    const responseBuilder = handlerInput.responseBuilder;
    let sessionAttributes = handlerInput.attributesManager.getSessionAttributes();

    return new Promise((resolve) => {
      getUKPublicHolidays((data) => {

        let countrySpecified = false;
        let country = 'england-and-wales';
        let friendlyCountry = 'England';
        if (request.intent.slots.country &&
          request.intent.slots.country.value &&
          request.intent.slots.country.value !== '?'
        ) {
          friendlyCountry = request.intent.slots.country.value;
          countrySpecified = true;

          switch (friendlyCountry) {
            case 'Scotland':
              country = 'scotland';
              break;
            case 'Wales':
              country = 'england-and-wales';
              break;
            case 'Northern Ireland':
              country = 'northern-ireland';
              break;
            default:
              country = 'england-and-wales';
              break;
          }
        }

        let countryData = data[country];

        let currentDate = new Date();
        let nextHoliday = countryData.events.filter(function (a) {
          var d = new Date(a.date).valueOf();
          if (d > currentDate) return a
        }).sort(function (a, b) {
          var dateA = new Date(a.date),
            dateB = new Date(b.date);
          return dateA - dateB;
        })[0];


        let speechCountry = ''
        if (countrySpecified) {
          speechCountry = `in ${friendlyCountry}`
        }
        let speechOutput = `The next holiday ${speechCountry} is ${nextHoliday.title} its on ${nextHoliday.date}`;

        resolve(handlerInput.responseBuilder.speak(speechOutput).getResponse());
      });
    });

  },
};

const CountHolidaysIntent_Handler = {
  canHandle(handlerInput) {
    const request = handlerInput.requestEnvelope.request;
    return request.type === 'IntentRequest' && request.intent.name === 'CountHolidaysIntent';
  },
  handle(handlerInput) {
    const request = handlerInput.requestEnvelope.request;
    const responseBuilder = handlerInput.responseBuilder;
    let sessionAttributes = handlerInput.attributesManager.getSessionAttributes();

    let say = 'Hello from CountHolidaysIntent. ';

    let slotStatus = '';

    //   SLOT: timePeriod 
    let timePeriod = null;
    let timePeriodSpecified = false;
    if (request.intent.slots.timePeriod &&
      request.intent.slots.timePeriod.value &&
      request.intent.slots.timePeriod.value !== '?'
    ) {
      timePeriodSpecified = true;
      timePeriod = request.intent.slots.timePeriod;
      timePeriod = resolveCanonical(timePeriod);
    }

    //   SLOT: country 
    let countrySpecified = false;
    let country = 'england-and-wales';
    let friendlyCountry = 'England';
    if (request.intent.slots.country &&
      request.intent.slots.country.value &&
      request.intent.slots.country.value !== '?'
    ) {
      friendlyCountry = request.intent.slots.country;
      friendlyCountry = resolveCanonical(country);



      countrySpecified = true;

      switch (friendlyCountry) {
        case 'Scotland':
          country = 'scotland';
          break;
        case 'Wales':
          country = 'england-and-wales';
          break;
        case 'Northern Ireland':
          country = 'northern-ireland';
          break;
        default:
          country = 'england-and-wales';
          break;
      }

    }

    say += slotStatus;

    return new Promise((resolve) => {
      getUKPublicHolidays((data) => {

        let countryData = data[country];
        let currentDate = new Date();
        let countHolidays = 0;
        let periodDescription = '';
        if (timePeriodSpecified == false) {
          timePeriod = new Date().getFullYear().toString();
          say += 'time period has been set to ' + timePeriod;
        }
        if (timePeriod != null) {

          let aDate = new Date(timePeriod);
          say += 'timePeriod was ' + aDate;

          let firstDay = new Date(aDate);
          let lastDay = new Date(aDate);

          var monthMatchRegex = /\d{4}-\d{2}/
          var monthMatch = timePeriod.match(monthMatchRegex);

          if (monthMatch != null) {
            say += ' month match ' + aDate.getFullYear();

            firstDay.setMonth(aDate.getMonth(), 1);
            firstDay.setFullYear(currentDate.getFullYear());

            lastDay.setMonth(aDate.getMonth() + 1, 0);
            lastDay.setFullYear(currentDate.getFullYear());

            say += ' firstDay ' + firstDay + ' | ';
            say += ' lastDay ' + lastDay + ' | ';

            countHolidays = countryData.events.filter(function (a) {
              var d = new Date(a.date).valueOf();
              if (d >= firstDay && d <= lastDay) return a
            }).length;

            let locale = "en-us"
            timePeriod = aDate.toLocaleString(locale, {
              month: "long"
            });

          } else {
            var yearMatchRegex = /\d{4}$/
            var yearMatch = timePeriod.match(yearMatchRegex);

            let aDate = new Date(timePeriod);
            let firstDay = new Date(aDate);
            let lastDay = new Date(aDate);

            firstDay.setMonth(1, 1);

            lastDay.setMonth(12, 31);

            countHolidays = countryData.events.filter(function (a) {
              var d = new Date(a.date).valueOf();
              if (d >= firstDay && d <= lastDay) return a
            }).length;

            timePeriod = aDate.getFullYear();
          }
        }
        let speechOutput = '';
        if (countHolidays > 0) {
          speechOutput = 'I found ' + countHolidays + ' holidays in ' + timePeriod;
        } else {
          let noHolidaySayings = [
            "I\'m sorry, I can\'t find any holidays in " + timePeriod,
            "Ah, shucks....<break strength=\"strong\"/>there are no holidays in " + timePeriod,
            "Yikes, there are <say-as interpret-as=\"cardinal\">0</say-as> public holidays in " + timePeriod,
            "Well this is unfortunate. <break strength=\"strong\"/>There are no holidays in " + timePeriod
          ];
          speechOutput = randomElement(noHolidaySayings);
        }
        resolve(handlerInput.responseBuilder.speak(speechOutput).getResponse());
      });
    });
  },
};

const LaunchRequest_Handler = {
  canHandle(handlerInput) {
    const request = handlerInput.requestEnvelope.request;
    return request.type === 'LaunchRequest';
  },
  handle(handlerInput) {
    const responseBuilder = handlerInput.responseBuilder;


    let says = [
      "Hey, how can I help",
      "Hi, thanks for using " + invocationName,
      "Hello, whats up?",
      "Hi, need a break?"
    ];

    // let say = 'hello' + ' and welcome to ' + invocationName + ' ! Say help to hear some options.';
    let say = randomElement(says);

    let skillTitle = capitalize(invocationName);

    return responseBuilder
      .speak(say)
      // .reprompt('try again, ' + say)
      .withStandardCard('Welcome!',
        'Hello!\nThis is a card for your skill, ' + skillTitle,
        welcomeCardImg.smallImageUrl, welcomeCardImg.largeImageUrl)
      .getResponse();
  },
};

const SessionEndedHandler = {
  canHandle(handlerInput) {
    const request = handlerInput.requestEnvelope.request;
    return request.type === 'SessionEndedRequest';
  },
  handle(handlerInput) {
    console.log(`Session ended with reason: ${handlerInput.requestEnvelope.request.reason}`);
    return handlerInput.responseBuilder.getResponse();
  }
};

const ErrorHandler = {
  canHandle() {
    return true;
  },
  handle(handlerInput, error) {
    const request = handlerInput.requestEnvelope.request;

    console.log(`Error handled: ${error.message}`);
    console.log(`Original Request was: ${JSON.stringify(request, null, 2)}`);

    return handlerInput.responseBuilder
      .speak('Sorry, I can not understand the command.  Please say again.')
      .reprompt('Sorry, I can not understand the command.  Please say again.')
      .getResponse();
  }
};


// 2. Constants ===========================================================================

// Here you can define static data, to be used elsewhere in your code.  For example: 
//    const myString = "Hello World";
//    const myArray  = [ "orange", "grape", "strawberry" ];
//    const myObject = { "city": "Boston",  "state":"Massachusetts" };

const APP_ID = undefined; // TODO replace with your Skill ID (OPTIONAL).

// 3.  Helper Functions ===================================================================

function capitalize(myString) {

  return myString.replace(/(?:^|\s)\S/g, function (a) {
    return a.toUpperCase();
  });
}


function randomElement(myArray) {
  return (myArray[Math.floor(Math.random() * myArray.length)]);
}


function resolveCanonical(slot) {
  let canonical = '';
  if (slot.hasOwnProperty('resolutions')) {
    canonical = slot.resolutions.resolutionsPerAuthority[0].values[0].value.name;
  } else {
    canonical = slot.value;
  }

  return canonical;
}


function getSlotValues(filledSlots) {
  const slotValues = {};

  console.log(`The filled slots: ${JSON.stringify(filledSlots)}`);
  Object.keys(filledSlots).forEach((item) => {
    const name = filledSlots[item].name;

    if (filledSlots[item] &&
      filledSlots[item].resolutions &&
      filledSlots[item].resolutions.resolutionsPerAuthority[0] &&
      filledSlots[item].resolutions.resolutionsPerAuthority[0].status &&
      filledSlots[item].resolutions.resolutionsPerAuthority[0].status.code) {
      switch (filledSlots[item].resolutions.resolutionsPerAuthority[0].status.code) {
        case 'ER_SUCCESS_MATCH':
          slotValues[name] = {
            synonym: filledSlots[item].value,
            resolved: filledSlots[item].resolutions.resolutionsPerAuthority[0].values[0].value.name,
            isValidated: true
          };
          break;
        case 'ER_SUCCESS_NO_MATCH':
          slotValues[name] = {
            synonym: filledSlots[item].value,
            resolved: filledSlots[item].value,
            isValidated: false
          };
          break;
        default:
          break;
      }
    } else {
      slotValues[name] = {
        synonym: filledSlots[item].value,
        resolved: filledSlots[item].value,
        isValidated: false
      };
    }
  }, this);

  return slotValues;
}

function supportsDisplay(handlerInput) // returns true if the skill is running on a device with a display (Echo Show, Echo Spot, etc.) 
{ //  Enable your skill for display as shown here: https://alexa.design/enabledisplay 
  const hasDisplay =
    handlerInput.requestEnvelope.context &&
    handlerInput.requestEnvelope.context.System &&
    handlerInput.requestEnvelope.context.System.device &&
    handlerInput.requestEnvelope.context.System.device.supportedInterfaces &&
    handlerInput.requestEnvelope.context.System.device.supportedInterfaces.Display;

  return hasDisplay;
}


const welcomeCardImg = {
  smallImageUrl: "https://s3.amazonaws.com/skill-images-789/cards/card_plane720_480.png",
  largeImageUrl: "https://s3.amazonaws.com/skill-images-789/cards/card_plane1200_800.png"


};

const DisplayImg1 = {
  title: 'Jet Plane',
  url: 'https://s3.amazonaws.com/skill-images-789/display/plane340_340.png'
};
const DisplayImg2 = {
  title: 'Starry Sky',
  url: 'https://s3.amazonaws.com/skill-images-789/display/background1024_600.png'

};

function getCustomIntents() {
  const modelIntents = interactionModel.interactionModel.languageModel.intents;

  let customIntents = [];


  for (let i = 0; i < modelIntents.length; i++) {

    if (modelIntents[i].name.substring(0, 7) != "AMAZON." && modelIntents[i].name !== "LaunchRequest") {
      customIntents.push(modelIntents[i]);
    }
  }
  return customIntents;
}

function getSampleUtterance(intent) {


  return randomElement(intent.samples);

}

function getPreviousIntent(attrs) {

  if (attrs.history && attrs.history.length > 1) {
    return attrs.history[attrs.history.length - 2].IntentRequest;

  } else {
    return false;
  }

}

function timeDelta(t1, t2) {

  const dt1 = new Date(t1);
  const dt2 = new Date(t2);
  const timeSpanMS = dt2.getTime() - dt1.getTime();
  const span = {
    "timeSpanMIN": Math.floor(timeSpanMS / (1000 * 60)),
    "timeSpanHR": Math.floor(timeSpanMS / (1000 * 60 * 60)),
    "timeSpanDAY": Math.floor(timeSpanMS / (1000 * 60 * 60 * 24)),
    "timeSpanDesc": ""
  };


  if (span.timeSpanHR < 2) {
    span.timeSpanDesc = span.timeSpanMIN + " minutes";
  } else if (span.timeSpanDAY < 2) {
    span.timeSpanDesc = span.timeSpanHR + " hours";
  } else {
    span.timeSpanDesc = span.timeSpanDAY + " days";
  }


  return span;

}


const InitMemoryAttributesInterceptor = {
  process(handlerInput) {
    let sessionAttributes = {};
    if (handlerInput.requestEnvelope.session['new']) {

      sessionAttributes = handlerInput.attributesManager.getSessionAttributes();

      let memoryAttributes = getMemoryAttributes();

      if (Object.keys(sessionAttributes).length === 0) {

        Object.keys(memoryAttributes).forEach(function (key) { // initialize all attributes from global list 

          sessionAttributes[key] = memoryAttributes[key];

        });

      }
      handlerInput.attributesManager.setSessionAttributes(sessionAttributes);


    }
  }
};

const RequestHistoryInterceptor = {
  process(handlerInput) {

    const thisRequest = handlerInput.requestEnvelope.request;
    let sessionAttributes = handlerInput.attributesManager.getSessionAttributes();

    let history = sessionAttributes['history'] || [];

    let IntentRequest = {};
    if (thisRequest.type === 'IntentRequest') {

      let slots = [];

      IntentRequest = {
        'IntentRequest': thisRequest.intent.name
      };

      if (thisRequest.intent.slots) {

        for (let slot in thisRequest.intent.slots) {
          let slotObj = {};
          slotObj[slot] = thisRequest.intent.slots[slot].value;
          slots.push(slotObj);
        }

        IntentRequest = {
          'IntentRequest': thisRequest.intent.name,
          'slots': slots
        };

      }

    } else {
      IntentRequest = {
        'IntentRequest': thisRequest.type
      };
    }
    if (history.length > maxHistorySize - 1) {
      history.shift();
    }
    history.push(IntentRequest);

    handlerInput.attributesManager.setSessionAttributes(sessionAttributes);

  }

};




const RequestPersistenceInterceptor = {
  process(handlerInput) {

    if (handlerInput.requestEnvelope.session['new']) {

      return new Promise((resolve, reject) => {

        handlerInput.attributesManager.getPersistentAttributes()

          .then((sessionAttributes) => {
            sessionAttributes = sessionAttributes || {};


            sessionAttributes['launchCount'] += 1;

            handlerInput.attributesManager.setSessionAttributes(sessionAttributes);

            handlerInput.attributesManager.savePersistentAttributes()
              .then(() => {
                resolve();
              })
              .catch((err) => {
                reject(err);
              });
          });

      });

    } // end session['new'] 
  }
};


const ResponsePersistenceInterceptor = {
  process(handlerInput, responseOutput) {

    const ses = (typeof responseOutput.shouldEndSession == "undefined" ? true : responseOutput.shouldEndSession);

    if (ses || handlerInput.requestEnvelope.request.type == 'SessionEndedRequest') { // skill was stopped or timed out 

      let sessionAttributes = handlerInput.attributesManager.getSessionAttributes();

      sessionAttributes['lastUseTimestamp'] = new Date(handlerInput.requestEnvelope.request.timestamp).getTime();

      handlerInput.attributesManager.setPersistentAttributes(sessionAttributes);

      return new Promise((resolve, reject) => {
        handlerInput.attributesManager.savePersistentAttributes()
          .then(() => {
            resolve();
          })
          .catch((err) => {
            reject(err);
          });

      });

    }

  }
};



// 4. Exports handler function and setup ===================================================
const skillBuilder = Alexa.SkillBuilders.standard();
exports.handler = skillBuilder
  .addRequestHandlers(
    AMAZON_CancelIntent_Handler,
    AMAZON_HelpIntent_Handler,
    AMAZON_StopIntent_Handler,
    FindNextHolidayIntent_Handler,
    CountHolidaysIntent_Handler,
    LaunchRequest_Handler,
    SessionEndedHandler
  )
  .addErrorHandlers(ErrorHandler)
  .addRequestInterceptors(InitMemoryAttributesInterceptor)
  .addRequestInterceptors(RequestHistoryInterceptor)

  // .addRequestInterceptors(RequestPersistenceInterceptor)
  // .addResponseInterceptors(ResponsePersistenceInterceptor)

  // .withTableName("askMemorySkillTable")
  // .withAutoCreateTable(true)

  .lambda();



// End of Skill code -------------------------------------------------------------
// Static Language Model for reference

const interactionModel = {
  "interactionModel": {
    "languageModel": {
      "invocationName": "uk bank holidays",
      "intents": [{
          "name": "AMAZON.CancelIntent",
          "samples": []
        },
        {
          "name": "AMAZON.HelpIntent",
          "samples": []
        },
        {
          "name": "AMAZON.StopIntent",
          "samples": []
        },
        {
          "name": "FindNextHolidayIntent",
          "slots": [{
            "name": "country",
            "type": "AVAILABLE_COUNTRY"
          }],
          "samples": [
            "can I get a break in {country}",
            "can we get a public holiday in {country}",
            "please can I get a break in {country}",
            "when is there a break in {country}",
            "when is the next break in {country}",
            "when can I get a break in {country}",
            "when can I get a holiday in {country}",
            "when can I get a public holiday in {country}",
            "when is there a bank holiday in {country}",
            "when is there a public holiday in {country}",
            "when can I get a day off in {country}",
            "next bank holiday in {country}",
            "when is the next bank holiday in {country}",
            "when is the next public holiday in {country}",
            "when is there a holiday in {country}",
            "when is the next national vacation in {country}",
            "when do I get a day off in {country}",
            "next day off {country}",
            "when's my next day off in {country}",
            "next national vacation in {country}",
            "next state holiday in {country}",
            "when's the next state holiday in {country}",
            "when's the next national vacation in {country}",
            "when's the next national holiday in {country}",
            "whens the next bank holiday in {country}",
            "next day off in {country}",
            "when is the next day off in {country}",
            "next public holiday in {country}",
            "next public holiday",
            "next day off",
            "next holiday",
            "When is the next holiday",
            "when is the next holiday in {country}"
          ]
        },
        {
          "name": "CountHolidaysIntent",
          "slots": [{
              "name": "timePeriod",
              "type": "AMAZON.DATE"
            },
            {
              "name": "country",
              "type": "AVAILABLE_COUNTRY"
            }
          ],
          "samples": [
            "number of state holidays in {country} in {timePeriod}",
            "number o fbank holidays in {country}",
            "number of public holidays in {country}",
            "number of days off in {country}",
            "how many break days do I get in {country}",
            "how many holidays can we get in {country}",
            "how many bank holidays do we get in {country}",
            "how many bank holidays in {timePeriod} in {country}",
            "how many public holidays in {timePeriod} in {country}",
            "how many days off do I get in {timePeriod} in {country}",
            "bank holidays in {timePeriod} in {country}",
            "public holidays in {timePeriod} in {country}",
            "days off in {timePeriod} in {country}",
            "public holidays in {country} this {timePeriod}",
            "bank holidays in {country} this {timePeriod}",
            "days off in {country} this {timePeriod}",
            "how many bank holidays this {timePeriod} in {country}",
            "how many public holidays this {timePeriod} in {country}",
            "how many days off this {timePeriod} in {country}"
          ]
        },
        {
          "name": "LaunchRequest"
        }
      ],
      "types": [{
        "name": "AVAILABLE_COUNTRY",
        "values": [{
            "name": {
              "value": "Northern Ireland",
              "synonyms": [
                "NI"
              ]
            }
          },
          {
            "name": {
              "value": "Wales"
            }
          },
          {
            "name": {
              "value": "Scotland"
            }
          },
          {
            "name": {
              "value": "England"
            }
          }
        ]
      }]
    }
  }
};