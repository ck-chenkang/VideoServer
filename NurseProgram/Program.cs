using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.Linq;
using System.Text;
using System.Threading;
using System.Threading.Tasks;


namespace NurseProgram
{
    class Program
    {
        static List<ProcessInfo> listProcess = new List<ProcessInfo>();
        static void Main(string[] args)
        {
            CameraInfo camera = new CameraInfo();
            CreateProcess(camera);

            Thread thread = new Thread(Ccout);
            thread.IsBackground = false;
            thread.Start();
            while (true)
            {
                Thread.Sleep(120000);
            }
        }

        /// <summary>
        /// 创建进程并将进程信息添加到我们的集合中
        /// </summary>
        /// <param name="camera"></param>

        private static void CreateProcess(CameraInfo camera)
        {
            //启动这个进程
            var decodeProcess = new Process
            {
                StartInfo = new ProcessStartInfo
                {
                    //Environment.CurrentDirectory 这个是获取本应用程序的路径
                    //FileName = Environment.CurrentDirectory  + "\\.exe",
                    FileName = @"D:\VideoServer\runShortCut",
                    //带过去的参数
                    UseShellExecute = true,
                    RedirectStandardInput = false,
                    RedirectStandardOutput = false,
                    RedirectStandardError = false,
                    CreateNoWindow = true
                }
            };
            decodeProcess.Start();
            //进程信息所在
            ProcessInfo processInfo = new ProcessInfo()
            {
                processId = decodeProcess.Id,
                cameraInfo = camera
            };
            //添加进程信息
            listProcess.Add(processInfo);

        }

        public static void Ccout()
        {
            while (true)
            {
                Thread.Sleep(1000);
                try
                {
                    //获取所有叫jt进程内的信息
                    Process[] processIdAry = Process.GetProcessesByName("runShortCut");
                    //循环我们的信息
                    foreach (var oneProcess in listProcess)
                    {
                        //如果我们这个ID程序在我们都Pid中出现
                        if (processIdAry.Where(n => n.Id == oneProcess.processId).Count() > 0)
                        {
#if true
                            Console.WriteLine("成功维护一次");
#endif
                        }
                        else
                        {

                            Console.WriteLine("一个进程中断，正在执行重启任务");
                            listProcess.Remove(oneProcess);
                            //获取带过去的参数
                            CameraInfo camera = oneProcess.cameraInfo;
                            //重启这个进程
                            CreateProcess(camera);
                            Console.WriteLine("重启成功");
                        }
                    }
                }
                catch (Exception)
                {

                }
            }
        }
    }

    public class CameraInfo
    {
        public Guid id { get; set; }
        public string name { get; set; }
    }
    public class ProcessInfo
    {
        public int processId { get; set; }
        public CameraInfo cameraInfo { get; set; }
    }
}

