// npm install --save neo4j-driver
// node example.js
const neo4j = require('neo4j-driver');
const driver = neo4j.driver('neo4j://<HOST>:<BOLTPORT>',
                  neo4j.auth.basic('<USERNAME>', '<PASSWORD>'), 
                  {});

const query =
  `
  MATCH (u:User {screen_name: $screenName})<-[r:MENTIONS]-(t:Tweet)-[r2:TAGS]->(h:Hashtag)
  RETURN h.name as hashtag
  `;

const params = {"screenName": "NASA"};

const session = driver.session({database:"neo4j"});

session.run(query, params)
  .then((result) => {
    result.records.forEach((record) => {
        console.log(record.get('hashtag'));
    });
    session.close();
    driver.close();
  })
  .catch((error) => {
    console.error(error);
  });
