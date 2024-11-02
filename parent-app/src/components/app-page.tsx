"use client";

import { useEffect, useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from "recharts";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { DynamoDB } from "aws-sdk";
import { S3 } from "aws-sdk";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@radix-ui/react-popover";
import { Calendar } from "@/components/ui/calendar";
import { CalendarIcon, Plus } from "lucide-react";
import { Button } from "./ui/button";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { Input } from "@/components/ui/input";

const CONVERSATION_TABLE_NAME =
  process.env.NEXT_PUBLIC_CONVERSATION_TABLE_NAME || "";
const DAILY_SUMMARY_TABLE_NAME =
  process.env.NEXT_PUBLIC_DAILY_SUMMARY_TABLE_NAME || "";
const MONTHLY_SUMMARY_TABLE_NAME =
  process.env.NEXT_PUBLIC_MONTHLY_SUMMARY_TABLE_NAME || "";
const NG_LIST_TABLE_NAME = process.env.NEXT_PUBLIC_NG_LIST_TABLE_NAME || "";

interface ActivityData {
  userId: string;
  timestamp: number;
  conversation: Array<{
    role: string;
    text: string;
  }>;
  date: string;
  Images: Array<{
    url: string;
    signedUrl?: string;
    timestamp: number;
  }>;
  summary: string;
  summary_title: string;
  time: string;
}

interface DailyActivityData {
  date: string;
  userId: string;
  language_communication_explanation: string;
  language_communication_score: number;
  language_communication_notable_words: string;
  cognitive_development_explanation: string;
  cognitive_development_score: number;
  social_emotional_explanation: string;
  social_emotional_score: number;
  summary: string;
  summary_title: string;
  timestamp: string;
}
interface MonthlyData {
  month: string;
  userId: string;
  language_communication_explanation: string;
  language_communication_score: number;
  language_communication_notable_words: string;
  cognitive_development_explanation: string;
  cognitive_development_score: number;
  social_emotional_explanation: string;
  social_emotional_score: number;
  summary: string;
}

const dynamoDb = new DynamoDB.DocumentClient({
  region: process.env.NEXT_PUBLIC_AWS_REGION,
  accessKeyId: process.env.NEXT_PUBLIC_AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.NEXT_PUBLIC_AWS_SECRET_ACCESS_KEY,
});

const s3 = new S3({
  region: process.env.NEXT_PUBLIC_AWS_REGION,
  accessKeyId: process.env.NEXT_PUBLIC_AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.NEXT_PUBLIC_AWS_SECRET_ACCESS_KEY,
});

const getSignedUrl = async (url: string): Promise<string> => {
  const bucket = process.env.NEXT_PUBLIC_AWS_BUCKET_NAME;
  if (!bucket) throw new Error("Bucket name is not defined");

  const key = url.split(".com/")[1];
  const params = {
    Bucket: bucket,
    Key: key,
    Expires: 60 * 5,
  };

  const preSignedUrl = await s3.getSignedUrlPromise("getObject", params);
  console.log("preSignedUrl", preSignedUrl);
  return preSignedUrl;
};

const childOverview = {
  name: "Charlotte Kensington",
  age: 5,
  grade: "2nd Grade",
  avatar: "/Taro.png",
  interests: [
    "Drawing and painting",
    "Playing with dolls and stuffed animals",
    "Reading picture books",
    "Building with blocks and LEGO",
    "Dancing to music",
  ],
};

const yearlyData = {
  "Language & Communication": [
    { month: "Jan", score: 4.3 },
    { month: "Feb", score: 4.7 },
    { month: "Mar", score: 5.0 },
    { month: "Apr", score: 5.3 },
    { month: "May", score: 5.7 },
    { month: "Jun", score: 6.0 },
    { month: "Jul", score: 6.3 },
    { month: "Aug", score: 6.7 },
    { month: "Sep", score: 7.0 },
    { month: "Oct", score: 7.3 },
    { month: "Nov", score: 7.7 },
    { month: "Dec", score: 8.0 },
  ],
  "Cognitive Development": [
    { month: "Jan", score: 2.7 },
    { month: "Feb", score: 3.0 },
    { month: "Mar", score: 3.3 },
    { month: "Apr", score: 3.7 },
    { month: "May", score: 4.0 },
    { month: "Jun", score: 4.3 },
    { month: "Jul", score: 4.7 },
    { month: "Aug", score: 4.9 },
    { month: "Sep", score: 5.1 },
    { month: "Oct", score: 5.3 },
    { month: "Nov", score: 5.5 },
    { month: "Dec", score: 5.7 },
  ],
  "Social & Emotional": [
    { month: "Jan", score: 3.7 },
    { month: "Feb", score: 4.0 },
    { month: "Mar", score: 4.3 },
    { month: "Apr", score: 4.7 },
    { month: "May", score: 5.0 },
    { month: "Jun", score: 5.3 },
    { month: "Jul", score: 5.5 },
    { month: "Aug", score: 5.7 },
    { month: "Sep", score: 6.0 },
    { month: "Oct", score: 6.2 },
    { month: "Nov", score: 6.4 },
    { month: "Dec", score: 6.6 },
  ],
};

export function Page() {
  const [selectedCategory, setSelectedCategory] = useState("");
  const [selectedDataPoint, setSelectedDataPoint] = useState(null);
  const [isDailySummaryDialogOpen, setIsDailySummaryDialogOpen] =
    useState(false);
  const [isRecentActivityDialogOpen, setIsRecentActivityDialogOpen] =
    useState(false);
  const [selectedDailySummary, setSelectedDailySummary] =
    useState<DailyActivityData | null>(null);
  const [selectedRecentActivity, setSelectedRecentActivity] =
    useState<ActivityData | null>(null);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [dailyActivities, setDailyActivities] = useState<DailyActivityData[]>(
    []
  );
  const [activities, setActivities] = useState<ActivityData[]>([]);
  const [monthlyData, setMonthlyData] = useState<MonthlyData | null>(null);
  const [date, setDate] = useState<Date>();
  const [ngWords, setNgWords] = useState<string[]>([]);
  const [newNgWord, setNewNgWord] = useState("");
  useEffect(() => {
    fetchRecentActivities();
    fetchDailyActivities();
    fetchMonthlyData();
    fetchNgWords();
  }, []);

  const fetchRecentActivities = async () => {
    const params = {
      TableName: CONVERSATION_TABLE_NAME,
      KeyConditionExpression: "userId = :userId",
      ExpressionAttributeValues: {
        ":userId": "1", 
      },
      ScanIndexForward: false, 
      Limit: 20
    };
  
    try {
      const result = await dynamoDb.query(params).promise();
      if (result.Items) {
        const activitiesWithSignedUrls = await Promise.all(
          result.Items.map(async (item) => {
            const activity = item as ActivityData;
            if (activity.Images) {
              activity.Images = await Promise.all(
                activity.Images.map(async (image) => ({
                  ...image,
                  signedUrl: await getSignedUrl(image.url),
                }))
              );
            }
            return activity;
          })
        );
        setActivities(activitiesWithSignedUrls);
      }
    } catch (error) {
      console.error("Error fetching recent activities:", error);
    }
  };

  const fetchDailyActivities = async () => {
    const params = {
      TableName: DAILY_SUMMARY_TABLE_NAME,
      Limit: 100,
      ScanIndexForward: false,
    };

    try {
      const result = await dynamoDb.scan(params).promise();
      const formattedActivities =
        result.Items?.map(
          (item) =>
            ({
              date: item.date,
              userId: item.userId,
              language_communication_explanation:
                item.language_communication_explanation,
              language_communication_score: item.language_communication_score,
              language_communication_notable_words:
                item.language_communication_notable_words,
              cognitive_development_explanation:
                item.cognitive_development_explanation,
              cognitive_development_score: item.cognitive_development_score,
              social_emotional_explanation: item.social_emotional_explanation,
              social_emotional_score: item.social_emotional_score,
              summary: item.summary,
              summary_title: item.summary_title,
              timestamp: item.timestamp,
            } as DailyActivityData)
        ) || [];
      setDailyActivities(formattedActivities);
    } catch (error) {
      console.error("Error fetching daily activities:", error);
    }
  };

  const fetchMonthlyData = async () => {
    const currentDate = new Date();
    const currentMonth = `${currentDate.getFullYear()}-${String(
      currentDate.getMonth() + 1
    ).padStart(2, "0")}`;

    const params = {
      TableName: MONTHLY_SUMMARY_TABLE_NAME,
      KeyConditionExpression: "userId = :userId AND #month = :month",
      ExpressionAttributeNames: {
        "#month": "month",
      },
      ExpressionAttributeValues: {
        ":userId": "1",
        ":month": currentMonth,
      },
    };

    try {
      const result = await dynamoDb.query(params).promise();
      if (result.Items && result.Items.length > 0) {
        const item = result.Items[0] as MonthlyData;
        setMonthlyData(item);
        console.log("Fetched monthly data:", item);
      } else {
        console.log("No data found for the current month");
        setMonthlyData(null);
      }
    } catch (error) {
      console.error("Error fetching data from DynamoDB:", error);
    }
  };

  const fetchNgWords = async () => {
    const params = {
      TableName: NG_LIST_TABLE_NAME,
      KeyConditionExpression: "userId = :userId",
      ExpressionAttributeValues: {
        ":userId": "1", // 仮のユーザーID
      },
    };

    try {
      const result = await dynamoDb.query(params).promise();
      if (result.Items) {
        const words = result.Items.map((item) => item.ngWord);
        setNgWords(words);
      }
    } catch (error) {
      console.error("Error fetching NG words:", error);
    }
  };

  const handleDataPointClick = (data, category) => {
    setSelectedCategory(category);
    setSelectedDataPoint(data);
    setIsDailySummaryDialogOpen(true);
  };

  const handleDailySummaryClick = (activity: DailyActivityData) => {
    setSelectedDailySummary(activity);
    setIsDailySummaryDialogOpen(true);
  };

  const handleRecentActivityClick = (activity: ActivityData) => {
    setSelectedRecentActivity(activity);
    setCurrentImageIndex(0);
    setIsRecentActivityDialogOpen(true);
  };

  const handleNextImage = () => {
    if (
      selectedRecentActivity &&
      selectedRecentActivity.Images &&
      selectedRecentActivity.Images.length > 0
    ) {
      setCurrentImageIndex(
        (prevIndex) => (prevIndex + 1) % selectedRecentActivity.Images!.length
      );
    }
  };

  const handlePrevImage = () => {
    if (
      selectedRecentActivity &&
      selectedRecentActivity.Images &&
      selectedRecentActivity.Images.length > 0
    ) {
      setCurrentImageIndex(
        (prevIndex) =>
          (prevIndex - 1 + selectedRecentActivity.Images!.length) %
          selectedRecentActivity.Images!.length
      );
    }
  };

  const handleAddNgWord = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newNgWord && !ngWords.includes(newNgWord)) {
      try {
        const params = {
          TableName: NG_LIST_TABLE_NAME,
          Item: {
            userId: "1", // 仮のユーザーID。実際の実装では適切なユーザーIDを使用してください。
            ngWord: newNgWord,
          },
        };
        await dynamoDb.put(params).promise();

        setNgWords([...ngWords, newNgWord]);
        setNewNgWord("");
      } catch (error) {
        console.error("Error adding NG word to DynamoDB:", error);
        // エラーハンドリング（例：ユーザーにエラーメッセージを表示）
      }
    }
  };

  return (
    <div className="w-full max-w-full mx-auto p-4">
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="col-span-1 space-y-6">
          <Card className="col-span-1">
            <CardHeader>
              <CardTitle>Child Overview</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col items-center">
                <Avatar className="w-24 h-24 mb-4">
                  <AvatarImage src="/Charlotte.webp" alt={childOverview.name} />
                  <AvatarFallback>{childOverview.name[0]}</AvatarFallback>
                </Avatar>
                <h2 className="text-2xl font-bold mb-2">
                  {childOverview.name}
                </h2>
                <p className="text-gray-600 mb-4">
                  {childOverview.age} years old
                </p>
                <h3 className="text-lg font-semibold mb-2">Interests</h3>
                <ul className="w-full list-disc pl-5">
                  {childOverview.interests.map((interest, index) => (
                    <li key={index} className="mb-1">
                      {interest}
                    </li>
                  ))}
                </ul>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>NG Words List</CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="mb-4 list-disc pl-5">
                {ngWords.map((word, index) => (
                  <li key={index} className="mb-1">
                    {word}
                  </li>
                ))}
              </ul>
              <form
                onSubmit={handleAddNgWord}
                className="flex items-center space-x-2"
              >
                <Input
                  type="text"
                  placeholder="New NG word"
                  value={newNgWord}
                  onChange={(e) => setNewNgWord(e.target.value)}
                  className="flex-grow"
                />
                <Button type="submit" size="icon">
                  <Plus className="h-4 w-4" />
                  <span className="sr-only">Add NG word</span>
                </Button>
              </form>
            </CardContent>
          </Card>
        </div>
        <div className="col-span-1 md:col-span-3">
          <Tabs defaultValue="overview" className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="overview">Overview</TabsTrigger>
              {/* <TabsTrigger value="monthly">Monthly Details</TabsTrigger> */}
              <TabsTrigger value="recent">Recent Activities</TabsTrigger>
            </TabsList>
            <TabsContent value="overview">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6">
                <Card className="col-span-1 md:col-span-2">
                  <CardHeader>
                    <CardTitle>Latest Month Development Assessment</CardTitle>
                  </CardHeader>
                  <CardContent>
                    {monthlyData ? (
                      <div className="flex flex-col md:flex-row gap-6">
                        <div className="w-full md:w-1/2">
                          <h3 className="text-lg font-semibold mb-2">
                            Monthly Summary
                          </h3>
                          <p className="mb-4">{monthlyData.summary}</p>
                          <div className="h-[300px] mb-4">
                            <ResponsiveContainer width="100%" height="100%">
                              <RadarChart
                                cx="50%"
                                cy="50%"
                                outerRadius="80%"
                                data={[
                                  {
                                    subject: "Language & Communication",
                                    A: monthlyData.language_communication_score,
                                    fullMark: 10,
                                  },
                                  {
                                    subject: "Cognitive Development",
                                    A: monthlyData.cognitive_development_score,
                                    fullMark: 10,
                                  },
                                  {
                                    subject: "Social & Emotional",
                                    A: monthlyData.social_emotional_score,
                                    fullMark: 10,
                                  },
                                ]}
                              >
                                <PolarGrid />
                                <PolarAngleAxis dataKey="subject" />
                                <PolarRadiusAxis angle={30} domain={[0, 10]} />
                                <Radar
                                  name={monthlyData.month}
                                  dataKey="A"
                                  stroke="#8884d8"
                                  fill="#8884d8"
                                  fillOpacity={0.6}
                                />
                              </RadarChart>
                            </ResponsiveContainer>
                          </div>
                        </div>
                        <div className="w-full md:w-1/2">
                          <h3 className="text-lg font-semibold mb-2">
                            Category Comments
                          </h3>
                          <div className="mb-2">
                            <h4 className="font-semibold">
                              Language & Communication
                            </h4>
                            <p>
                              {monthlyData.language_communication_explanation}
                            </p>
                            <div className="mt-2">
                              <h5 className="font-medium">
                                Notable Words This Month:
                              </h5>
                              <p>
                                {
                                  monthlyData.language_communication_notable_words
                                }
                              </p>
                            </div>
                          </div>
                          <div className="mb-2">
                            <h4 className="font-semibold">
                              Cognitive Development
                            </h4>
                            <p>
                              {monthlyData.cognitive_development_explanation}
                            </p>
                          </div>
                          <div className="mb-2">
                            <h4 className="font-semibold">
                              Social & Emotional
                            </h4>
                            <p>{monthlyData.social_emotional_explanation}</p>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <p>No data available for the current month.</p>
                    )}
                  </CardContent>
                </Card>
                {Object.entries(yearlyData).map(([category, data]) => (
                  <Card key={category}>
                    <CardHeader>
                      <CardTitle>{category}</CardTitle>
                    </CardHeader>
                    <CardContent className="h-[200px]">
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={data}>
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis dataKey="month" />
                          <YAxis domain={[0, 10]} />
                          <Tooltip />
                          <Line
                            type="monotone"
                            dataKey="score"
                            stroke="#8884d8"
                            activeDot={{
                              onClick: (event, payload) =>
                                handleDataPointClick(payload.payload, category),
                            }}
                          />
                        </LineChart>
                      </ResponsiveContainer>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </TabsContent>
            <TabsContent value="recent">
              <div className="mt-6">
                <Card className="mb-6">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-lg flex justify-between items-center">
                      <span>Recent Activities</span>
                      <Popover>
                        <PopoverTrigger asChild>
                          <Button
                            variant="outline"
                            className={cn(
                              "justify-start text-left font-normal",
                              !date && "text-muted-foreground"
                            )}
                          >
                            <CalendarIcon className="mr-2 h-4 w-4" />
                            {date ? (
                              format(date, "PPP")
                            ) : (
                              <span>Filter by date</span>
                            )}
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="end">
                          <Calendar
                            mode="single"
                            selected={date}
                            onSelect={setDate}
                            initialFocus
                          />
                        </PopoverContent>
                      </Popover>
                    </CardTitle>
                  </CardHeader>
                </Card>
              </div>
              <div className="space-y-6 mt-6">
                {dailyActivities
                  .sort((a, b) => {
                    const dateA = new Date(a.date);
                    const dateB = new Date(b.date);
                    return dateB.getTime() - dateA.getTime();
                  })
                  .map((activity, index) => (
                    <Card
                      key={index}
                      className="cursor-pointer"
                      onClick={() => handleDailySummaryClick(activity)}
                    >
                      <CardHeader>
                        <CardTitle>{activity.date}</CardTitle>
                      </CardHeader>
                      {/*analysis of the day*/}
                      <CardContent>
                        <div className="flex flex-col md:flex-row gap-6">
                          <div className="flex-1">
                            <div className="mb-6">
                              <h3 className="text-xl font-semibold mb-2">
                                {activity.summary_title}
                              </h3>
                              <p className="text-sm">{activity.summary}</p>
                            </div>
                            <div>
                              <h4 className="text-lg font-semibold mb-2">
                                Developmental Progress
                              </h4>
                              <ul className="space-y-4">
                                <li>
                                  <div className="flex justify-between items-center mb-1">
                                    <span className="font-medium">
                                      Language & Communication
                                    </span>
                                    <span className="text-sm text-gray-600">
                                      {activity.language_communication_score.toFixed(
                                        1
                                      )}{" "}
                                      / 10
                                    </span>
                                  </div>
                                </li>
                                <li>
                                  <div className="flex justify-between items-center mb-1">
                                    <span className="font-medium">
                                      Cognitive Development
                                    </span>
                                    <span className="text-sm text-gray-600">
                                      {activity.cognitive_development_score.toFixed(
                                        1
                                      )}{" "}
                                      / 10
                                    </span>
                                  </div>
                                </li>
                                <li>
                                  <div className="flex justify-between items-center mb-1">
                                    <span className="font-medium">
                                      Social & Emotional
                                    </span>
                                    <span className="text-sm text-gray-600">
                                      {activity.social_emotional_score.toFixed(
                                        1
                                      )}{" "}
                                      / 10
                                    </span>
                                  </div>
                                </li>
                              </ul>
                            </div>
                          </div>
                          {/* Related Activities */}
                          <div className="md:w-1/2">
                            <h4 className="text-lg font-semibold mb-2">
                              Related Activities
                            </h4>
                            <div className="overflow-x-auto">
                              <div className="flex space-x-4 pb-4">
                                {activities
                                  .filter((a) => a.date === activity.date)
                                  .sort((a, b) => {
                                    const dateTimeA = new Date(
                                      `${a.date}T${a.time}`
                                    );
                                    const dateTimeB = new Date(
                                      `${b.date}T${b.time}`
                                    );
                                    return (
                                      dateTimeA.getTime() - dateTimeB.getTime()
                                    ); // Sort in ascending order
                                  })
                                  .map((relatedActivity, relatedIndex) => (
                                    <Card
                                      key={relatedIndex}
                                      className="cursor-pointer flex-shrink-0 w-64"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleRecentActivityClick(
                                          relatedActivity
                                        );
                                      }}
                                    >
                                      <CardHeader className="p-4">
                                        <CardTitle className="text-sm">
                                          {relatedActivity.time}
                                        </CardTitle>
                                      </CardHeader>
                                      <CardContent className="p-4">
                                        {relatedActivity.Images &&
                                          relatedActivity.Images.length > 0 &&
                                          relatedActivity.Images[0]
                                            .signedUrl && (
                                            <img
                                              src={
                                                relatedActivity.Images[0]
                                                  .signedUrl
                                              }
                                              alt={`Activity at ${relatedActivity.time}`}
                                              className="w-full h-24 object-cover rounded-md mb-2"
                                            />
                                          )}
                                        <p className="text-xs line-clamp-2">
                                          {relatedActivity.summary}
                                        </p>
                                      </CardContent>
                                    </Card>
                                  ))}
                              </div>
                            </div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
              </div>
            </TabsContent>
          </Tabs>
        </div>
      </div>

      {/* Daily Summary Dialog */}
      <Dialog
        open={isDailySummaryDialogOpen}
        onOpenChange={setIsDailySummaryDialogOpen}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{selectedDailySummary?.date}</DialogTitle>
          </DialogHeader>
          {selectedDailySummary && (
            <div>
              <p className="mb-4">{selectedDailySummary.summary}</p>
              <h4 className="font-semibold mb-2">Evaluation Scores</h4>
              <ul>
                <li>
                  Language & Communication:{" "}
                  {selectedDailySummary.language_communication_score}
                </li>
                <li>
                  Cognitive Development:{" "}
                  {selectedDailySummary.cognitive_development_score}
                </li>
                <li>
                  Social & Emotional:{" "}
                  {selectedDailySummary.social_emotional_score}
                </li>
              </ul>
              <h4 className="font-semibold mt-4 mb-2">Explanations</h4>
              <p>
                <strong>Language & Communication:</strong>{" "}
                {selectedDailySummary.language_communication_explanation}
              </p>
              <p>
                <strong>Notable Words:</strong>{" "}
                {selectedDailySummary.language_communication_notable_words}
              </p>
              <p>
                <strong>Cognitive Development:</strong>{" "}
                {selectedDailySummary.cognitive_development_explanation}
              </p>
              <p>
                <strong>Social & Emotional:</strong>{" "}
                {selectedDailySummary.social_emotional_explanation}
              </p>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Recent Activity Dialog */}
      <Dialog
        open={isRecentActivityDialogOpen}
        onOpenChange={setIsRecentActivityDialogOpen}
      >
        <DialogContent className="max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {selectedRecentActivity?.date} {selectedRecentActivity?.time}
            </DialogTitle>
          </DialogHeader>
          {selectedRecentActivity && (
            <div className="space-y-4">
              <p>{selectedRecentActivity.summary}</p>
              {selectedRecentActivity.Images &&
                selectedRecentActivity.Images.length > 0 && (
                  <div className="relative">
                    <img
                      src={
                        selectedRecentActivity.Images[currentImageIndex]
                          .signedUrl ||
                        selectedRecentActivity.Images[currentImageIndex].url
                      }
                      alt={`Activity on ${selectedRecentActivity.date}`}
                      className="w-full h-64 object-cover rounded-md"
                    />
                    {selectedRecentActivity.Images.length > 1 && (
                      <>
                        <button
                          onClick={handlePrevImage}
                          className="absolute left-2 top-1/2 transform -translate-y-1/2 bg-black bg-opacity-50 text-white p-2 rounded-full"
                        >
                          &lt;
                        </button>
                        <button
                          onClick={handleNextImage}
                          className="absolute right-2 top-1/2 transform -translate-y-1/2 bg-black bg-opacity-50 text-white p-2 rounded-full"
                        >
                          &gt;
                        </button>
                      </>
                    )}
                  </div>
                )}
              <div>
                <h4 className="font-semibold mb-2">Conversation</h4>
                {selectedRecentActivity.conversation &&
                  selectedRecentActivity.conversation.map((item, index) => (
                    <div key={index} className="mb-2">
                      <strong>{item.role}: </strong>
                      {item.text}
                    </div>
                  ))}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
