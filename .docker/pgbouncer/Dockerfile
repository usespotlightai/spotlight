FROM alpine:3.22
RUN apk add --no-cache pgbouncer
COPY .docker/pgbouncer/pgbouncer.ini .docker/pgbouncer/userlist.txt /etc/pgbouncer/
USER nobody
EXPOSE 6432
ENV POSTGRES_HOST=db
CMD ["sh", "-c", "sed \"s|host=db port=|host=$POSTGRES_HOST port=|\" /etc/pgbouncer/pgbouncer.ini > /tmp/pgbouncer.ini && grep -q \"host=$POSTGRES_HOST port=\" /tmp/pgbouncer.ini && exec pgbouncer /tmp/pgbouncer.ini"]
