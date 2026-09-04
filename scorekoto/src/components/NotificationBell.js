"use client";


import { useState } from "react";

import Link from "next/link";

import notifications from "@/data/notifications";



export default function NotificationBell() {

    const [open, setOpen] = useState(false);



    const unreadCount =
        notifications.filter(
            (item) => !item.read
        ).length;



    return (

        <div className="notification-wrapper">


            <button

                className="notification-button"

                onClick={() =>
                    setOpen(!open)
                }

            >

                🔔


                {
                    unreadCount > 0 &&

                    <span className="notification-count">

                        {unreadCount}

                    </span>
                }


            </button>




            {
                open &&

                <div className="notification-panel">


                    <div className="notification-header">

                        Notifications

                    </div>



                    {
                        notifications.map(
                            (notification) => (

                                <Link

                                    key={notification.id}

                                    href={
                                        `/matches/${notification.matchId}`
                                    }

                                    className={
                                        notification.read
                                            ?
                                            "notification-item"
                                            :
                                            "notification-item unread"
                                    }

                                    onClick={() =>
                                        setOpen(false)
                                    }

                                >


                                    <div className="notification-icon">

                                        {
                                            getIcon(
                                                notification.type
                                            )
                                        }

                                    </div>



                                    <div className="notification-content">


                                        <strong>
                                            {notification.title}
                                        </strong>


                                        <p>
                                            {notification.message}
                                        </p>


                                        <span>
                                            {notification.time}
                                        </span>


                                    </div>


                                </Link>

                            )
                        )
                    }


                </div>

            }


        </div>

    );

}




function getIcon(type) {

    if (type === "goal")
        return "⚽";


    if (type === "live")
        return "🔴";


    if (type === "upcoming")
        return "⏰";


    return "🏁";

}