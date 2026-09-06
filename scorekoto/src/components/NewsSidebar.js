import news from "@/data/news";


export default function NewsSidebar() {

    const latestNews = news.slice(0, 5);


    return (

        <aside className="news-sidebar">

            <h2>
                News
            </h2>


            <div className="news-list">

                {latestNews.map((item) => (

                    <article
                        key={item.id}
                        className="news-item"
                    >


                        <img
                            src={item.image}
                            alt=""
                            className="news-image"
                        />


                        <div className="news-content">


                            <h3>
                                {item.title}
                            </h3>


                            <p>
                                {item.category}
                                {" · "}
                                {item.time}
                            </p>


                        </div>


                    </article>

                ))}


            </div>


        </aside>

    );

}