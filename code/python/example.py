# pip3 install neo4j-driver
# python3 example.py

from neo4j import GraphDatabase, basic_auth

driver = GraphDatabase.driver(
  "bolt://<HOST>:<BOLTPORT>",
  auth=basic_auth("<USERNAME>", "<PASSWORD>"))

cypher_query = '''
MATCH (u:User {screen_name: $screenName})<-[r:MENTIONS]-(t:Tweet)-[r2:TAGS]->(h:Hashtag)
RETURN h.name as hashtag
'''

with driver.session(database="neo4j") as session:
  results = session.read_transaction(
    lambda tx: tx.run(cypher_query,
                      screenName="NASA").data())
  for record in results:
    print(record['hashtag'])

driver.close()
