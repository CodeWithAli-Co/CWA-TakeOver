import React, { useEffect, useState } from "react";
import { Github, UserCircle, RefreshCw, Send } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/shadcnComponents/card";
import { Badge } from "@/components/ui/shadcnComponents/badge";
import { Button } from "@/components/ui/shadcnComponents/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/shadcnComponents/tabs";
import supabase from "../supabase";


// Type definitions for GitHub webhook payload
interface GitHubCommitDetail {
  id: string;
  message: string;
  author: string;
  timestamp: string;
}

interface GitHubCommitGroup {
  id: string;
  event_type: string;
  repo: string;
  branch: string;
  author: string;
  author_avatar: string;
  timestamp: string;
  commits: GitHubCommitDetail[];
  received_at?: string;
}

interface GitHubWebhookComponentProps {
  // If you want to filter by specific repos
  repoFilter?: string[];
  // Max number of stored historical events
  maxStoredEvents?: number;
}

const CommitDetail: React.FC<GitHubCommitDetail> = ({ id, message, author }) => {
  return (
    <div className="flex items-start space-x-2 py-1 text-sm">
      <div className="flex-shrink-0 w-16 font-mono text-red-300">{id.substring(0, 7)}</div>
      <div className="flex-grow">
        <span className="text-white">{message}</span>
        {author && (
          <span className="text-red-400 ml-2">- {author}</span>
        )}
      </div>
    </div>
  );
};

const GitHubWebhookComponent: React.FC<GitHubWebhookComponentProps> = ({ 
  repoFilter,
  maxStoredEvents = 200 // Default to storing 200 events
}) => {
  // Store all webhooks data, both current and historical
  const [allWebhookData, setAllWebhookData] = useState<GitHubCommitGroup[]>([]);
  // Track recently received webhooks separately
  const [recentWebhookData, setRecentWebhookData] = useState<GitHubCommitGroup[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<string>("recent");
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  // Load stored webhooks from Supabase on component mount
  useEffect(() => {
    fetchStoredWebhooks();
  }, []);

  // Function to fetch stored webhooks from Supabase
  const fetchStoredWebhooks = async () => {
    try {
      const { data, error } = await supabase
        .from('github_webhooks')
        .select('*')
        .order('timestamp', { ascending: false })
        .limit(maxStoredEvents);

      if (error) {
        throw error;
      }

      if (data) {
        console.log('Fetched webhooks from Supabase:', data);
        setAllWebhookData(data);
      }
    } catch (err) {
      console.error('Error loading stored webhooks from Supabase:', err);
    }
  };

  // Function to save new webhooks to Supabase
  const saveWebhooksToSupabase = async (webhooks: GitHubCommitGroup[]) => {
    try {
      if (webhooks.length === 0) return;

      const { data, error } = await supabase
        .from('github_webhooks')
        .upsert(webhooks, { 
          onConflict: 'id',
          ignoreDuplicates: true
        });

      if (error) {
        console.error('Error saving webhooks to Supabase:', error);
      } else {
        console.log('Successfully saved webhooks to Supabase:', data);
      }
    } catch (err) {
      console.error('Error in saveWebhooksToSupabase:', err);
    }
  };

  // Function to fetch webhook data from the API
  const fetchWebhooks = async () => {
    try {
      setLoading(true);
      
      // Call the API endpoint to get GitHub webhooks
      const response = await fetch('http://127.0.0.1:3000/webhooks/github', {
        method: 'GET'
      });
      
      if (!response.ok) {
        throw new Error(`Error fetching webhook data: ${response.status}`);
      }
      
      const data = await response.json();
      console.log('Fetched webhook data from API:', data);
      
      // Filter by repo if specified
      const filteredData = repoFilter 
        ? data.filter((event: GitHubCommitGroup) => repoFilter.some(repo => event.repo.includes(repo)))
        : data;
      
      // Set the recent webhooks
      setRecentWebhookData(filteredData);
      
      // Process the new webhook data
      const dataWithTimestamps = filteredData.map((item: GitHubCommitGroup) => ({
        ...item, 
        timestamp: item.timestamp || new Date().toISOString(),
        received_at: new Date().toISOString()
      }));

      // Filter out webhooks we already have in allWebhookData
      const existingIds = new Set(allWebhookData.map(item => item.id));
      const newItems = dataWithTimestamps.filter((item: any) => !existingIds.has(item.id));
      
      if (newItems.length > 0) {
        // Save new items to Supabase
        await saveWebhooksToSupabase(newItems);
        
        // Update state with combined data
        const combinedData = [...newItems, ...allWebhookData];
        const limitedData = combinedData.length > maxStoredEvents 
          ? combinedData.slice(0, maxStoredEvents) 
          : combinedData;
        
        setAllWebhookData(limitedData);
      }
      
      setLastUpdated(new Date());
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An unknown error occurred');
      console.error('Error fetching GitHub webhook data:', err);
    } finally {
      setLoading(false);
    }
  };

  // Test the webhook endpoint
  const testWebhook = async () => {
    try {
      setLoading(true);
      
      const response = await fetch('http://127.0.0.1:3000/api/webhooks/github', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-GitHub-Event': 'ping',
          'X-GitHub-Delivery': `test-${Date.now()}`
        },
        body: JSON.stringify({
          zen: 'Test ping from app',
          repository: {
            full_name: 'test/repo'
          }
        })
      });
      
      if (response.ok) {
        console.log('Webhook test successful');
        const testData = await response.json();
        console.log('TestHook Response Data:', testData);
        // Fetch the latest webhooks after test
        fetchWebhooks();
      } else {
        setError(`Webhook test failed: ${response.status}`);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An unknown error occurred');
      console.error('Error testing webhook:', err);
    } finally {
      setLoading(false);
    }
  };

  // Clear stored webhook history
  const clearHistory = async () => {
    if (window.confirm('Are you sure you want to clear the webhook history?')) {
      try {
        // Delete all records from Supabase
        const { error } = await supabase
          .from('github_webhooks')
          .delete()
          .not('id', 'is', null); // Safety check to avoid deleting all rows if something goes wrong
        
        if (error) {
          throw error;
        }
        
        // Clear the state
        setAllWebhookData([]);
        console.log('Webhook history cleared successfully');
      } catch (err) {
        console.error('Error clearing webhook history:', err);
        alert('Failed to clear webhook history');
      }
    }
  };

  useEffect(() => {
    // Fetch webhook data on component mount
    fetchWebhooks();
    
    // Set up a polling interval to fetch new webhook data every 10 seconds
    const intervalId = setInterval(fetchWebhooks, 10000);
    
    return () => clearInterval(intervalId);
  }, [repoFilter]);

  // Choose which data to display based on the active tab
  const displayData = activeTab === "recent" ? recentWebhookData : allWebhookData;

  if (loading && displayData.length === 0) {
    return <div className="text-white text-center py-8">Loading GitHub webhook data...</div>;
  }

  if (error && displayData.length === 0) {
    return (
      <div className="text-red-400 text-center py-8">
        <div>Error: {error}</div>
        <Button 
          onClick={fetchWebhooks} 
          className="mt-4 bg-red-900 hover:bg-red-800"
        >
          Try Again
        </Button>
        <Button 
          onClick={testWebhook} 
          className="mt-4 ml-2 bg-red-900 hover:bg-red-800"
        >
          Test Webhook
        </Button>
      </div>
    );
  }

  if (displayData.length === 0) {
    return (
      <div className="text-gray-400 text-center py-8">
        <div>No GitHub webhook data available</div>
        <Button 
          onClick={testWebhook} 
          className="mt-4 bg-red-900 hover:bg-red-800"
        >
          Test Webhook
        </Button>
        <Button 
          onClick={fetchWebhooks} 
          className="mt-4 ml-2 bg-red-900 hover:bg-red-800"
        >
          Refresh
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center">
          <Github className="h-6 w-6 mr-2 text-red-300" />
          <h2 className="text-xl font-semibold text-white">GitHub Webhooks</h2>
          {lastUpdated && (
            <div className="text-xs text-gray-400 ml-4">
              Last updated: {lastUpdated.toLocaleString()}
            </div>
          )}
        </div>
        <div className="flex space-x-2">
          <Button 
            onClick={fetchWebhooks}
            className="bg-red-900 hover:bg-red-800 text-sm"
            size="sm"
          >
            <RefreshCw className="h-4 w-4 mr-1" /> Refresh
          </Button>
          <Button 
            onClick={testWebhook}
            className="bg-red-900 hover:bg-red-800 text-sm"
            size="sm"
          >
            <Send className="h-4 w-4 mr-1" /> Test
          </Button>
          {allWebhookData.length > 0 && (
            <Button 
              onClick={clearHistory}
              variant="destructive"
              className="text-sm"
              size="sm"
            >
              Clear History
            </Button>
          )}
        </div>
      </div>

      <Tabs defaultValue="recent" value={activeTab} onValueChange={setActiveTab}>
        <div className="border-b border-red-950/30">
          <TabsList className="bg-transparent">
            <TabsTrigger 
              value="recent" 
              className="data-[state=active]:bg-red-950/30 data-[state=active]:text-white data-[state=active]:shadow-none"
            >
              Recent ({recentWebhookData.length})
            </TabsTrigger>
            <TabsTrigger 
              value="all" 
              className="data-[state=active]:bg-red-950/30 data-[state=active]:text-white data-[state=active]:shadow-none"
            >
              All History ({allWebhookData.length})
            </TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="recent">
          <CommitsList webhookData={recentWebhookData} />
        </TabsContent>
        
        <TabsContent value="all">
          <CommitsList webhookData={allWebhookData} />
        </TabsContent>
      </Tabs>
    </div>
  );
};

// Extracted CommitsList component for reuse between tabs
const CommitsList = ({ webhookData }: { webhookData: GitHubCommitGroup[] }) => {
  // Group commits by date
  const groupedByDate = webhookData.reduce((groups, event) => {
    const date = new Date(event.timestamp).toLocaleDateString();
    if (!groups[date]) {
      groups[date] = [];
    }
    groups[date].push(event);
    return groups;
  }, {} as Record<string, GitHubCommitGroup[]>);

  // Sort dates in descending order (newest first)
  const sortedDates = Object.keys(groupedByDate).sort((a, b) => 
    new Date(b).getTime() - new Date(a).getTime()
  );

  return (
    <div className="space-y-6">
      {sortedDates.map(date => (
        <div key={date} className="space-y-4">
          <div className="sticky top-0 bg-black/80 backdrop-blur-sm py-2 border-b border-red-950/30 z-10">
            <h3 className="text-white font-medium">
              {date === new Date().toLocaleDateString() ? "Today" : date}
            </h3>
          </div>
          
          <div className="space-y-4">
            {groupedByDate[date]
              .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
              .map((event) => (
                <Card key={event.id} className="bg-black/60 border-red-950/30 overflow-hidden backdrop-blur-sm">
                  <CardHeader className="p-4 flex flex-row items-center space-x-2">
                    <div className="h-10 w-10 rounded-full overflow-hidden flex-shrink-0 bg-gray-800">
                      <Github className="h-full w-full p-2 text-white" />
                    </div>
                    <div className="flex-grow">
                      <CardTitle className="text-lg flex items-center">
                        <span className="text-white truncate max-w-xs">{event.repo}</span>
                        <Badge className="ml-2 bg-blue-600 hover:bg-blue-700 text-xs">
                          {event.branch}
                        </Badge>
                        <span className="text-xs text-red-300 ml-auto">
                          {new Date(event.timestamp).toLocaleTimeString()}
                        </span>
                      </CardTitle>
                    </div>
                  </CardHeader>

                  <CardContent className="p-0">
                    <div className="border-t border-red-950/30 p-4">
                      <div className="flex items-center mb-2">
                        <div className="h-8 w-8 rounded-full overflow-hidden flex-shrink-0 bg-gray-800 mr-2">
                          {event.author_avatar ? (
                            <img src={event.author_avatar} alt={event.author} className="h-full w-full object-cover" />
                          ) : (
                            <UserCircle className="h-full w-full p-1 text-gray-400" />
                          )}
                        </div>
                        <div className="font-medium text-white">{event.author}</div>
                      </div>
                      
                      <div className="pl-10">
                        <div className="text-blue-400 mb-2">
                          {event.commits.length} new {event.commits.length === 1 ? 'commit' : 'commits'}
                        </div>
                        
                        {event.commits.map((commit, idx) => (
                          <CommitDetail 
                            key={idx} 
                            id={commit.id} 
                            message={commit.message}
                            author={commit.author}
                            timestamp={commit.timestamp}
                          />
                        ))}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
          </div>
        </div>
      ))}
    </div>
  );
};

export default GitHubWebhookComponent;