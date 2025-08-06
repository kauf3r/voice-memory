#!/usr/bin/env node

const { Server } = require('@modelcontextprotocol/sdk/server/index.js');
const { StdioServerTransport } = require('@modelcontextprotocol/sdk/server/stdio.js');
const { createClient } = require('@supabase/supabase-js');

class SupabaseMCPServer {
  constructor() {
    this.server = new Server(
      {
        name: 'supabase-mcp-server',
        version: '1.0.0',
      },
      {
        capabilities: {
          tools: {},
        },
      }
    );

    this.supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_KEY
    );

    this.setupTools();
  }

  setupTools() {
    this.server.setRequestHandler('tools/list', async () => {
      return {
        tools: [
          {
            name: 'query_database',
            description: 'Execute SQL queries against Supabase database',
            inputSchema: {
              type: 'object',
              properties: {
                query: {
                  type: 'string',
                  description: 'SQL query to execute'
                }
              },
              required: ['query']
            }
          },
          {
            name: 'get_table_info',
            description: 'Get information about database tables',
            inputSchema: {
              type: 'object',
              properties: {
                table: {
                  type: 'string',
                  description: 'Table name to get info for'
                }
              },
              required: ['table']
            }
          }
        ]
      };
    });

    this.server.setRequestHandler('tools/call', async (request) => {
      const { name, arguments: args } = request.params;

      switch (name) {
        case 'query_database':
          try {
            const { data, error } = await this.supabase.rpc('exec_sql', { 
              sql_query: args.query 
            });
            
            if (error) throw error;
            
            return {
              content: [
                {
                  type: 'text',
                  text: JSON.stringify(data, null, 2)
                }
              ]
            };
          } catch (error) {
            return {
              content: [
                {
                  type: 'text',
                  text: `Error: ${error.message}`
                }
              ]
            };
          }

        case 'get_table_info':
          try {
            const { data, error } = await this.supabase
              .from('information_schema.columns')
              .select('*')
              .eq('table_name', args.table);
            
            if (error) throw error;
            
            return {
              content: [
                {
                  type: 'text',
                  text: JSON.stringify(data, null, 2)
                }
              ]
            };
          } catch (error) {
            return {
              content: [
                {
                  type: 'text',
                  text: `Error: ${error.message}`
                }
              ]
            };
          }

        default:
          throw new Error(`Unknown tool: ${name}`);
      }
    });
  }

  async run() {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    console.error('Supabase MCP Server running...');
  }
}

const server = new SupabaseMCPServer();
server.run().catch(console.error); 