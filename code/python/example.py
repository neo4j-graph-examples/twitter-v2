# pip3 install neo4j
# python3 example.py

from neo4j import GraphDatabase, basic_auth

cypher_query = '''
MATCH (u:User {screen_name: $screenName})<-[r:MENTIONS]-(t:Tweet)-[r2:TAGS]->(h:Hashtag)
RETURN h.name as hashtag
'''

with GraphDatabase.driver(
    "neo4j://<HOST>:<BOLTPORT>",
    auth=("<USERNAME>", "<PASSWORD>")
) as driver:
    result = driver.execute_query(
        cypher_query,
        screenName="NASA",
        database_="neo4j")
    for record in result.records:
        print(record['hashtag'])
