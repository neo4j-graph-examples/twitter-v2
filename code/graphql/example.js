const { Neo4jGraphQL } = require("@neo4j/graphql");
const { ApolloServer } = require("apollo-server");
const neo4j = require("neo4j-driver");

const driver = neo4j.driver(
  "bolt://<HOST>:<BOLTPORT>",
  neo4j.auth.basic("<USERNAME>", "<PASSWORD>")
);

const typeDefs = /* GraphQL */ `
type Tweet {
  created_at: DateTime
  favorites: Int
  id: ID!
  id_str: String
  import_method: String
  text: String
  using: [Source] @relationship(type: "USING", direction: OUT)
  tags: [Hashtag] @relationship(type: "TAGS", direction: OUT)
  retweets: [Tweet] @relationship(type: "RETWEETS", direction: OUT)
  reply_to: [Tweet] @relationship(type: "REPLY_TO", direction: OUT)
  contains: [Link] @relationship(type: "CONTAINS", direction: OUT)
  posted_by: User @relationship(type: "POSTS", direction: IN)
}

type Me {
  followers: Int!
  following: Int!
  location: String!
  name: String!
  profile_image_url: String!
  screen_name: ID!
  posts: [Tweet] @relationship(type: "POSTS", direction: OUT)
  users: [User] @relationship(type: "FOLLOWS", direction: IN)
  tweets: [Tweet] @relationship(type: "MENTIONS", direction: IN)
}

type Hashtag {
  name: String!
  tweets: [Tweet] @relationship(type: "TAGS", direction: IN)
  num_tweets: Int @cypher(statement: "RETURN SIZE( (this)<-[:TAGS]-(:Tweet) )")
}

type Link {
  url: String!
  tweets: [Tweet] @relationship(type: "CONTAINS", direction: IN)
}

type Source {
  name: String!
  tweets: [Tweet] @relationship(type: "USING", direction: IN)
}

type User {
  followers: Int
  following: Int
  location: String
  name: String!
  profile_image_url: String
  screen_name: String!
  statuses: Int
  url: String
  posts: [Tweet] @relationship(type: "POSTS", direction: OUT)
  tweets: [Tweet] @relationship(type: "MENTIONS", direction: IN)
}

type UserCount {
  count: Int
  user: User
}

type HashtagCount {
    count: Int
    name: String
}

type UserTweet {
   screen_name: String
   name: String
   profile_pic: String
   created_at: DateTime
   text: String
}

extend type Me {
   topMentions(first: Int = 5): [UserCount] 
    @cypher(
      statement: """
      MATCH (this)-[:POSTS]->(t:Tweet)-[:MENTIONS]->(m:User)
      WITH m, COUNT(m.screen_name) AS count 
      ORDER BY count DESC
      LIMIT $first
      RETURN { 
        user: m { .* }, 
        count: count 
      }
      """
    )
   topHashtags(first: Int = 5): [HashtagCount]
    @cypher(
      statement: """
      MATCH (this:Me)-[:POSTS]->(t:Tweet)-[:TAGS]->(h:Hashtag)
      WITH h, COUNT(h) AS count
      ORDER BY count DESC
      LIMIT $first
      RETURN {
        name: h.name,
        count: count
      }
      """
    )
   followbackCount: Int
    @cypher(
      statement: """
      MATCH (me:Me)-[:FOLLOWS]->(f:User)
      WHERE (f)-[:FOLLOWS]->(me)
      RETURN count(f)
      """
    )
   recommended(first: Int = 10): [UserCount]
    @cypher(
      statement: """
      MATCH (u:User)-[:POSTS]->(t:Tweet)-[:MENTIONS]->(me:Me)
      WITH DISTINCT u, me, count(t) as count
      WHERE (u)-[:FOLLOWS]->(me)
      AND NOT (me)-[:FOLLOWS]->(u)
      RETURN { 
        user: u { .* }, 
        count: count 
      }
      ORDER BY count DESC
      LIMIT $first
      """
    )
    priorityFeed: [UserTweet]
    @cypher(
      statement: """
      MATCH (t:Tweet) WHERE t.created_at IS NOT NULL
      WITH max(t.created_at) - duration('P3D') as recentDate
      CALL {
        WITH recentDate
        MATCH (this:Me)-[r:SIMILAR_TO]-(u:User)
        WITH u, recentDate
        ORDER BY r.score DESC
        LIMIT 10
        MATCH (u)-[:POSTS]->(t:Tweet)
        WHERE t.created_at >= recentDate
        WITH u, t
        ORDER BY t.created_at DESC
        LIMIT 50
        RETURN {
          screen_name: u.screen_name,
          name: u.name,
          profile_pic: u.profile_image_url,
          created_at: t.created_at,
          text: t.text
        } as tweets
        UNION
        WITH recentDate
        MATCH (u:User)-[r:POSTS]->(t:Tweet)
        WHERE t.created_at >= recentDate AND NOT u:Me
        WITH u, t
        ORDER BY t.created_at DESC
        LIMIT 50
        RETURN {
          screen_name: u.screen_name,
          name: u.name,
          profile_pic: u.profile_image_url,
          created_at: t.created_at,
          text: t.text
        } as tweets
        ORDER BY t.created_at DESC
        LIMIT 50
      }
      RETURN tweets
      """
    )
}

extend type User {
  topMentions: UserCount
    @cypher(
      statement: """
      MATCH (this)-[:POSTS]->(t:Tweet)-[:MENTIONS]->(m:User)
      WITH m, COUNT(m.screen_name) AS count
      ORDER BY count DESC
      LIMIT 1
      RETURN {
         user: m {.*},
         count: count
      }
      """
    )
}

extend type Tweet {
  mentions: [User] @relationship(type: "MENTIONS", direction: OUT)
}

extend type Hashtag {
    trendingTags(first: Int = 5): [HashtagCount]
      @cypher(
        statement: """
        MATCH (t:Tweet)-[:TAGS]->(h:Hashtag)
        WITH h, count(h) as count
        ORDER BY count DESC
        LIMIT $first
        RETURN {
          name: h.name,
          count: count
        }
        """
      )
}
`;

// Create executable GraphQL schema from GraphQL type definitions,
// using @neo4j/graphql to autogenerate resolvers
const neoSchema = new Neo4jGraphQL({
  typeDefs,
  debug: true,
});

// Create ApolloServer instance that will serve GraphQL schema created above
// Inject Neo4j driver instance into the context object, which will be passed
//  into each (autogenerated) resolver
const server = new ApolloServer({
  context: { driver },
  schema: neoSchema.schema,
  introspection: true,
  playground: true,
});

// Start ApolloServer
server.listen().then(({ url }) => {
  console.log(`GraphQL server ready at ${url}`);
});
